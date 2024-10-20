use std::net::SocketAddr;
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
use chrono::{DurationRound, TimeDelta, Utc};
use data::{Kanji, KanjiClass, Loc, WordData};
use generate::{Generator, Hint, Puzzle, PuzzleOptions};
use indexmap::IndexMap;
use itertools::Itertools;
use rand::SeedableRng;
use serde::{Deserialize, Serialize};
use tower::{buffer::BufferLayer, limit::RateLimitLayer, ServiceBuilder};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub mod data;
pub mod generate;

#[derive(Clone)]
struct ApiState {
    pub kanjis: IndexMap<String, Kanji>,
    pub word_data: WordData,
}

impl ApiState {
    fn to_generator<R: rand::Rng>(&self, rng: R) -> Generator<R> {
        Generator::new(rng, &self.kanjis, &self.word_data)
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
    let kanjis = data::load_kanjis()?;
    let duration = start.elapsed();
    tracing::info!("Loaded kanjis in {duration:?}");

    tracing::info!("Starting to load words...");
    let start = Instant::now();
    let word_data = data::load_words(&kanjis)?;
    let duration = start.elapsed();
    tracing::info!("Loaded words in {duration:?}");

    let app = Router::new()
        .route("/v1/today", get(get_today))
        .route("/v1/random", get(get_random))
        .with_state(ApiState { word_data, kanjis })
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

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
struct ReqPuzzleOptions {
    difficulty: ReqDifficulty,
    mode: ReqMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ReqDifficulty {
    Simple,
    Easy,
    Normal,
    Hard,
    Lunatic,
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
            ReqDifficulty::Simple => PuzzleOptions {
                kanji_class: KanjiClass::Kyoiku,
                rare_kanji_rank: 0,
                rare_kanji_bias: 1.0,
                word_rarity_range: 0..5_000,
                irregular_hint_bias: 0.5,
                rare_kanji_hint_rank: 0,
                rare_kanji_hint_bias: 1.0,
                rare_word_hint_rank: 0,
                rare_word_hint_bias: 1.0,
                num_hints,
                guarantee_answer_by,
            },
            ReqDifficulty::Easy => PuzzleOptions {
                kanji_class: KanjiClass::Kyoiku,
                rare_kanji_rank: 0,
                rare_kanji_bias: 1.0,
                word_rarity_range: 0..10_000,
                irregular_hint_bias: 1.0,
                rare_kanji_hint_rank: 0,
                rare_kanji_hint_bias: 1.0,
                rare_word_hint_rank: 0,
                rare_word_hint_bias: 1.0,
                num_hints,
                guarantee_answer_by,
            },
            ReqDifficulty::Normal => PuzzleOptions {
                kanji_class: KanjiClass::Joyo,
                rare_kanji_rank: 0,
                rare_kanji_bias: 1.0,
                word_rarity_range: 0..30_000,
                irregular_hint_bias: 1.0,
                rare_kanji_hint_rank: 0,
                rare_kanji_hint_bias: 1.0,
                rare_word_hint_rank: 0,
                rare_word_hint_bias: 1.0,
                num_hints,
                guarantee_answer_by,
            },
            ReqDifficulty::Hard => PuzzleOptions {
                kanji_class: KanjiClass::Joyo,
                rare_kanji_rank: 2_000,
                rare_kanji_bias: 1.25,
                word_rarity_range: 0..60_000,
                irregular_hint_bias: 1.5,
                rare_kanji_hint_rank: 2_000,
                rare_kanji_hint_bias: 1.25,
                rare_word_hint_rank: 30_000,
                rare_word_hint_bias: 1.25,
                num_hints,
                guarantee_answer_by,
            },
            ReqDifficulty::Lunatic => PuzzleOptions {
                kanji_class: KanjiClass::Kentei,
                rare_kanji_rank: 2_000,
                rare_kanji_bias: 1.5,
                word_rarity_range: 0..90_000,
                irregular_hint_bias: 2.0,
                rare_kanji_hint_rank: 2_000,
                rare_kanji_hint_bias: 1.5,
                rare_word_hint_rank: 30_000,
                rare_word_hint_bias: 1.5,
                num_hints,
                guarantee_answer_by,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct ResPuzzle {
    hints: Vec<ResHint>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    extra_hints: Vec<ResHint>,
    answer: String,
}

impl ResPuzzle {
    fn new_from_puzzle(puzzle: &Puzzle) -> ResPuzzle {
        ResPuzzle {
            answer: puzzle.answer.text.clone(),
            hints: puzzle.hints.iter().map(ResHint::new_from_hint).collect(),
            extra_hints: puzzle
                .extra_hints
                .iter()
                .map(ResHint::new_from_hint)
                .collect(),
        }
    }
}

impl std::fmt::Display for ResPuzzle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.hints.iter().join("　"))
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ResHint {
    pub answer: Loc,
    pub hint: String,
}

impl ResHint {
    fn new_from_hint(hint: &Hint) -> ResHint {
        ResHint {
            answer: hint.answer_location,
            hint: hint.hint.text.clone(),
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

async fn get_today(
    State(state): State<ApiState>,
    extract::Query(payload): extract::Query<ReqPuzzleOptions>,
) -> Result<Json<ResPuzzle>, StatusCode> {
    let today = Utc::now().duration_trunc(TimeDelta::days(1)).unwrap();
    let mut g = state.to_generator_seeded(
        today.timestamp() as u64 + payload.mode as u64 * payload.difficulty as u64,
    );

    let puzzle = ResPuzzle::new_from_puzzle(&g.choose_puzzle(&payload.to_puzzle_options()));
    Ok(Json(puzzle))
}

async fn get_random(
    State(state): State<ApiState>,
    extract::Query(payload): extract::Query<ReqPuzzleOptions>,
) -> Result<Json<ResPuzzle>, StatusCode> {
    let mut g = state.to_generator_random();

    let puzzle = ResPuzzle::new_from_puzzle(&g.choose_puzzle(&payload.to_puzzle_options()));
    Ok(Json(puzzle))
}
