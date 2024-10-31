use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use std::{env, time::Duration};

use anyhow::Result;
use axum::extract::{self, State};
use axum::Json;
use axum::{
    error_handling::HandleErrorLayer,
    http::{Method, StatusCode},
    routing::get,
    BoxError, Router,
};
use chrono::{DateTime, Datelike, DurationRound, TimeDelta, Utc, Weekday};
use data::{Ji, KanjiClass, KanjiData, KanjiMeta, Loc, WordData, MAX_WORD_RANK};
use generate::{Generator, Hint, Puzzle, PuzzleOptions};
use rand::SeedableRng;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower::{buffer::BufferLayer, limit::RateLimitLayer, ServiceBuilder};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub mod data;
pub mod generate;

struct ApiState {
    pub kanji_data: KanjiData,
    pub word_data: WordData,
    pub cache: RwLock<BTreeMap<u64, ResPuzzle>>,
}

impl ApiState {
    fn to_generator<R: rand::Rng>(&self, rng: R) -> Generator<R> {
        Generator::new(rng, &self.kanji_data, &self.word_data)
    }

    fn to_generator_random(&self) -> Generator<impl rand::Rng> {
        self.to_generator(rand::thread_rng())
    }

    fn to_generator_seeded(&self, seed: u64) -> Generator<impl rand::Rng> {
        self.to_generator(rand_xoshiro::Xoshiro256PlusPlus::seed_from_u64(seed))
    }
}

#[tokio::main]
#[allow(clippy::needless_return)]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let port = env::var("KDLE_PORT")
        .ok()
        .and_then(|x| str::parse(&x).ok())
        .unwrap_or(3000);

    let rate_num = std::env::var("KDLE_RATE_NUM")
        .ok()
        .and_then(|x| str::parse(&x).ok())
        .unwrap_or(3);

    let rate_per = std::env::var("KDLE_RATE_PER")
        .ok()
        .and_then(|x| str::parse(&x).ok())
        .unwrap_or(6);

    tracing::info!("Starting to load kanji...");
    let start = Instant::now();
    let kanji_data = data::load_kanjis()?;
    let duration = start.elapsed();
    tracing::info!("Loaded kanjis in {duration:?}");

    tracing::info!("Starting to load words...");
    let start = Instant::now();
    let word_data = data::load_words(&kanji_data)?;
    let duration = start.elapsed();
    tracing::info!("Loaded words in {duration:?}");

    #[cfg(feature = "any-date")]
    let app = Router::new()
        .route("/v1/day", get(get_day))
        .route("/v1/today", get(get_today))
        .route("/v1/random", get(get_random));

    #[cfg(not(feature = "any-date"))]
    let app = Router::new()
        .route("/v1/today", get(get_today))
        .route("/v1/random", get(get_random));

    let app = app
        .with_state(Arc::new(ApiState {
            word_data,
            kanji_data,
            cache: RwLock::new(BTreeMap::new()),
        }))
        .layer(
            CorsLayer::new()
                .allow_methods(vec![Method::GET, Method::OPTIONS])
                .allow_origin(Any)
                .allow_headers(Any)
                .allow_credentials(false),
        )
        .layer(
            ServiceBuilder::new()
                .layer(HandleErrorLayer::new(|err: BoxError| async move {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Unhandled error: {}", err),
                    )
                }))
                .layer(BufferLayer::new(1024))
                .layer(RateLimitLayer::new(rate_num, Duration::from_secs(rate_per))),
        );

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[derive(Debug, Deserialize)]
struct ReqPuzzleOptions {
    difficulty: Difficulty,
    mode: ReqMode,
}

#[derive(Debug, Deserialize)]
struct ReqTodayPuzzleOptions {
    mode: ReqMode,
}

#[cfg(feature = "any-date")]
#[derive(Debug, Deserialize)]
struct ReqDayPuzzleOptions {
    mode: ReqMode,
    date: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
enum Difficulty {
    Simple,
    Easy,
    Normal,
    Hard,
    Lunatic,
    Lunatic2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ReqMode {
    Classic,
    Hidden,
}

impl ReqPuzzleOptions {
    fn to_puzzle_options(&self) -> PuzzleOptions {
        let (num_hints, guarantee_answer_by) = match self.mode {
            ReqMode::Classic => (4, 4),
            ReqMode::Hidden => (8, 4),
        };
        match self.difficulty {
            Difficulty::Simple => PuzzleOptions {
                min_kanji_class: KanjiClass::Kyoiku,
                max_kanji_class: KanjiClass::Kyoiku,
                rare_kanji_bias: 0.5,
                min_word_kanji_class: KanjiClass::Kyoiku,
                max_word_kanji_class: KanjiClass::Kyoiku,
                min_word_rarity: 0,
                max_word_rarity: 6_000,
                irregular_hint_bias: 0.5,
                rare_kanji_hint_bias: 0.5,
                rare_word_hint_bias: 0.5,
                num_hints,
                guarantee_answer_by,
            },
            Difficulty::Easy => PuzzleOptions {
                min_kanji_class: KanjiClass::Kyoiku,
                max_kanji_class: KanjiClass::Kyoiku,
                rare_kanji_bias: 1.0,
                min_word_kanji_class: KanjiClass::Kyoiku,
                max_word_kanji_class: KanjiClass::Kyoiku,
                min_word_rarity: 0,
                max_word_rarity: 12_000,
                irregular_hint_bias: 1.0,
                rare_kanji_hint_bias: 1.0,
                rare_word_hint_bias: 1.0,
                num_hints,
                guarantee_answer_by,
            },
            Difficulty::Normal => PuzzleOptions {
                min_kanji_class: KanjiClass::Kyoiku,
                max_kanji_class: KanjiClass::Joyo,
                rare_kanji_bias: 1.0,
                min_word_kanji_class: KanjiClass::Kyoiku,
                max_word_kanji_class: KanjiClass::Joyo,
                min_word_rarity: 0,
                max_word_rarity: 24_000,
                irregular_hint_bias: 1.0,
                rare_kanji_hint_bias: 1.0,
                rare_word_hint_bias: 1.0,
                num_hints,
                guarantee_answer_by,
            },
            Difficulty::Hard => PuzzleOptions {
                min_kanji_class: KanjiClass::Kyoiku,
                max_kanji_class: KanjiClass::Joyo,
                rare_kanji_bias: 2.0,
                min_word_kanji_class: KanjiClass::Kyoiku,
                max_word_kanji_class: KanjiClass::Joyo,
                min_word_rarity: 6_000,
                max_word_rarity: 48_000,
                irregular_hint_bias: 2.0,
                rare_kanji_hint_bias: 2.0,
                rare_word_hint_bias: 2.0,
                num_hints,
                guarantee_answer_by,
            },
            Difficulty::Lunatic => PuzzleOptions {
                min_kanji_class: KanjiClass::Joyo,
                max_kanji_class: KanjiClass::Kentei,
                rare_kanji_bias: 2.0,
                min_word_kanji_class: KanjiClass::Kyoiku,
                max_word_kanji_class: KanjiClass::Kentei,
                min_word_rarity: 12_000,
                max_word_rarity: 120_000,
                irregular_hint_bias: 2.0,
                rare_kanji_hint_bias: 2.0,
                rare_word_hint_bias: 2.0,
                num_hints,
                guarantee_answer_by,
            },
            Difficulty::Lunatic2 => PuzzleOptions {
                min_kanji_class: KanjiClass::Joyo,
                max_kanji_class: KanjiClass::All,
                rare_kanji_bias: 2.0,
                min_word_kanji_class: KanjiClass::Kyoiku,
                max_word_kanji_class: KanjiClass::All,
                min_word_rarity: 12_000,
                max_word_rarity: MAX_WORD_RANK,
                irregular_hint_bias: 2.0,
                rare_kanji_hint_bias: 2.0,
                rare_word_hint_bias: 2.0,
                num_hints,
                guarantee_answer_by,
            },
        }
    }
}

#[derive(Debug, Serialize, Clone)]
struct ResPuzzle {
    hints: Vec<ResHint>,
    extra_hints: Vec<ResHint>,
    answer: Ji,
    answer_meta: KanjiMeta,
    difficulty: Difficulty,
}

impl ResPuzzle {
    fn new_from_puzzle(
        puzzle: &Puzzle,
        kanji_data: &KanjiData,
        difficulty: Difficulty,
    ) -> ResPuzzle {
        ResPuzzle {
            answer: puzzle.answer,
            answer_meta: kanji_data.kanji_metas.get(&puzzle.answer).unwrap().clone(),
            hints: puzzle.hints.iter().map(ResHint::new_from_hint).collect(),
            extra_hints: puzzle
                .extra_hints
                .iter()
                .map(ResHint::new_from_hint)
                .collect(),
            difficulty,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct ResHint {
    pub answer: Loc,
    pub hint: Ji,
}

impl ResHint {
    fn new_from_hint(hint: &Hint) -> ResHint {
        ResHint {
            answer: hint.answer_location,
            hint: hint.hint,
        }
    }
}

impl std::fmt::Display for ResHint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.answer {
            Loc::L => write!(f, "◯{}", self.hint),
            Loc::R => write!(f, "{}◯", self.hint),
        }
    }
}

#[cfg(feature = "any-date")]
async fn get_day(
    State(state): State<Arc<ApiState>>,
    extract::Query(payload): extract::Query<ReqDayPuzzleOptions>,
) -> Result<Json<ResPuzzle>, StatusCode> {
    let today = DateTime::from_timestamp_millis(payload.date)
        .unwrap()
        .duration_trunc(TimeDelta::days(1))
        .unwrap();
    let difficulty = get_difficulty(today);
    let seed = get_seed(today, payload.mode, difficulty);

    let mut g = state.to_generator_seeded(seed);
    let puzzle = ResPuzzle::new_from_puzzle(
        &g.choose_puzzle(
            &ReqPuzzleOptions {
                mode: payload.mode,
                difficulty,
            }
            .to_puzzle_options(),
        ),
        &state.kanji_data,
        difficulty,
    );
    Ok(Json(puzzle))
}

const MAX_CACHE_LEN: usize = 2;

async fn get_today(
    State(state): State<Arc<ApiState>>,
    extract::Query(payload): extract::Query<ReqTodayPuzzleOptions>,
) -> Result<Json<ResPuzzle>, StatusCode> {
    let today = Utc::now().duration_trunc(TimeDelta::days(1)).unwrap();
    let difficulty = get_difficulty(today);
    let seed = get_seed(today, payload.mode, difficulty);

    if let Some(puzzle) = state.cache.read().await.get(&seed) {
        tracing::debug!("Using cache for puzzle {}", seed);
        return Ok(Json(puzzle.clone()));
    }

    let mut g = state.to_generator_seeded(seed);
    let puzzle = ResPuzzle::new_from_puzzle(
        &g.choose_puzzle(
            &ReqPuzzleOptions {
                mode: payload.mode,
                difficulty,
            }
            .to_puzzle_options(),
        ),
        &state.kanji_data,
        difficulty,
    );

    let mut cache = state.cache.write().await;
    if cache.len() >= MAX_CACHE_LEN {
        let (k, _) = cache.pop_first().unwrap();
        tracing::debug!("Removed from cache puzzle {}", k);
    }
    cache.insert(seed, puzzle.clone());

    Ok(Json(puzzle))
}

async fn get_random(
    State(state): State<Arc<ApiState>>,
    extract::Query(payload): extract::Query<ReqPuzzleOptions>,
) -> Result<Json<ResPuzzle>, StatusCode> {
    let mut g = state.to_generator_random();
    let puzzle = ResPuzzle::new_from_puzzle(
        &g.choose_puzzle(&payload.to_puzzle_options()),
        &state.kanji_data,
        payload.difficulty,
    );
    Ok(Json(puzzle))
}

fn get_seed(date: DateTime<Utc>, mode: ReqMode, difficulty: Difficulty) -> u64 {
    date.timestamp_millis() as u64 + (100 * (mode as u64) + (difficulty as u64))
}

fn get_difficulty(day: DateTime<Utc>) -> Difficulty {
    match day.weekday() {
        Weekday::Mon => Difficulty::Easy,
        Weekday::Tue => Difficulty::Normal,
        Weekday::Wed => Difficulty::Normal,
        Weekday::Thu => Difficulty::Hard,
        Weekday::Fri => Difficulty::Hard,
        Weekday::Sat => Difficulty::Lunatic,
        Weekday::Sun => Difficulty::Normal,
    }
}
