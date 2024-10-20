use std::{
    collections::{BTreeSet, HashMap},
    fs::File,
    io::{BufWriter, Write},
    sync::LazyLock,
};

use anyhow::{anyhow, Result};
use indexmap::IndexMap;
use itertools::Itertools;
use kana;
use regex::Regex;
use serde::{Deserialize, Serialize};

static ASSET_KANJIS: &str = "assets/wikipedia_kanjis.csv";
static ASSET_KANJI_META: &str = "assets/kanjiten.json";
static ASSET_WORDS: &str = "assets/jpdb_words.csv";

static GENERATED_KANJIS: &str = "generated/kanjis.json";
static GENERATED_WORDS: &str = "generated/words.csv";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Kanji {
    pub rank: usize,
    pub text: String,
    pub count: usize,
    pub meta: KanjiMeta,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KanjiClass {
    Kyoiku,
    Joyo,
    Kentei,
    All,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct KanjiMeta {
    pub level: String,
    pub class: KanjiClass,
    pub stroke_count: usize,
    pub radical: String,
    pub on: Vec<String>,
    pub kun: Vec<Kun>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Kun(
    pub String,
    #[serde(skip_serializing_if = "Option::is_none", default)] pub Option<String>,
);

#[derive(Debug, Clone, Deserialize)]
struct KanjiMetaRaw {
    text: String,
    on: String,
    kun: String,
    tags: String,
    _desc: Vec<String>,
    meta: HashMap<String, String>,
}

pub fn load_kanjis() -> Result<IndexMap<String, Kanji>> {
    if let Ok(file) = File::open(GENERATED_KANJIS) {
        tracing::info!("Reading kanjis from generated file...");
        return Ok(serde_json::from_reader(file)?);
    }

    let mut rdr = csv::Reader::from_path(ASSET_KANJIS)?;
    let kanjis = rdr.records().skip(1).process_results(|iter| {
        iter.map(|x| {
            let kanji: (usize, String, usize) = (
                x.get(0).ok_or(anyhow!("Missing rank in {x:?}"))?.parse()?,
                x.get(2).ok_or(anyhow!("Missing kanji in {x:?}"))?.into(),
                x.get(3).ok_or(anyhow!("Missing count in {x:?}"))?.parse()?,
            );
            Ok(kanji)
        })
        .collect::<Result<Vec<_>>>()
    })??;

    let meta_file = File::open(ASSET_KANJI_META)?;
    let json: Vec<KanjiMetaRaw> = serde_json::from_reader(meta_file)?;
    let kanjimetas = json
        .iter()
        .map(|x| (x.text.clone(), x))
        .collect::<HashMap<_, _>>();

    let kanjis: IndexMap<_, _> = kanjis
        .into_iter()
        .filter_map(|k| {
            let meta = kanjimetas.get(&k.1)?;
            Some((
                k.1.clone(),
                Kanji {
                    rank: k.0,
                    text: k.1,
                    count: k.2,
                    meta: KanjiMeta {
                        level: kana::wide2ascii(meta.tags.split_whitespace().last()?),
                        class: meta
                            .tags
                            .split_whitespace()
                            .map(|t| match t {
                                "教育漢字" => KanjiClass::Kyoiku,
                                "常用漢字" => KanjiClass::Joyo,
                                s if s.contains("級") => KanjiClass::Kentei,
                                _ => KanjiClass::All,
                            })
                            .next()
                            .unwrap_or(KanjiClass::All),
                        stroke_count: kana::wide2ascii(meta.meta.get("画数")?.split("画").next()?)
                            .parse()
                            .ok()?,
                        radical: meta
                            .meta
                            .get("部首")?
                            .split("（")
                            .next()?
                            .split_whitespace()
                            .join("・"),
                        on: meta.on.split(" ").map(String::from).collect(),
                        kun: meta
                            .kun
                            .split(" ")
                            .map(|s| {
                                let mut xs = s.split("（");
                                let x = xs.next().unwrap();
                                Kun(
                                    x.to_string(),
                                    xs.next().map(|y| y[0..y.len() - 1].to_string()),
                                )
                            })
                            .collect(),
                    },
                },
            ))
        })
        .collect();

    let file = File::create_new(GENERATED_KANJIS)?;
    let mut writer = BufWriter::new(file);
    serde_json::to_writer(&mut writer, &kanjis)?;
    writer.flush()?;

    Ok(kanjis)
}

pub static TWO_KANJI: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\p{Han})(\p{Han})$").unwrap());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Loc {
    L,
    R,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Word {
    pub text: String,
    pub reading: String,
    pub rank: usize,
}

#[derive(Debug, Clone)]
pub struct Compound2 {
    pub word: Word,
    pub a: Kanji,
    pub b: Kanji,
    pub irregular: bool,
}

#[derive(Debug, Clone)]
pub struct WordData {
    pub words: Vec<Word>,
    pub twos: Vec<Compound2>,
    pub keys: BTreeSet<String>,
}

pub fn load_words(kanjis: &IndexMap<String, Kanji>) -> Result<WordData> {
    let words = if let Ok(file) = File::open(GENERATED_WORDS) {
        tracing::info!("Reading words from generated file...");
        let mut reader = csv::Reader::from_reader(file);
        reader
            .deserialize()
            .process_results(|iter| iter.collect())?
    } else {
        let mut rdr = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .from_path(ASSET_WORDS)?;
        let words = rdr.records().process_results(|iter| {
            iter.map(|x| {
                Ok(Word {
                    text: x.get(0).ok_or(anyhow!("Missing word in {x:?}"))?.into(),
                    reading: x.get(1).ok_or(anyhow!("Missing reading in {x:?}"))?.into(),
                    rank: x.get(2).ok_or(anyhow!("Missing rank in {x:?}"))?.parse()?,
                })
            })
            .collect::<Result<Vec<_>>>()
        })??;

        let file = File::create_new(GENERATED_WORDS)?;
        let mut writer = csv::Writer::from_writer(BufWriter::new(file));
        for word in &words {
            writer.serialize(word)?;
        }
        writer.flush()?;

        words
    };

    let keys = words.iter().map(|w| w.text.clone()).collect();
    let twos = words
        .iter()
        .filter_map(|word| {
            let (_, [a, b]) = TWO_KANJI.captures(&word.text)?.extract();
            if a == b || b == "々" {
                None
            } else {
                let a = kanjis.get(a)?;
                let b = kanjis.get(b)?;
                Some(Compound2 {
                    word: word.clone(),
                    irregular: is_reading_irregular(&word.text, a, b),
                    a: a.clone(),
                    b: b.clone(),
                })
            }
        })
        .collect();
    Ok(WordData { words, twos, keys })
}

// Very rudimentary method of doing this but it should be fine
// Completely ignores things like okurigana and sound changes
// And only works on 2-character compounds
fn is_reading_irregular(word: &str, a: &Kanji, b: &Kanji) -> bool {
    a.meta.on.iter().any(|r| word.starts_with(r))
        || a.meta.kun.iter().any(|r| {
            word.starts_with(&r.0)
                || word.starts_with(&(r.0.clone() + r.1.as_deref().unwrap_or_default()))
        })
        || b.meta.on.iter().any(|r| word.ends_with(r))
        || b.meta.kun.iter().any(|r| {
            word.ends_with(&r.0)
                || word.ends_with(&(r.0.clone() + r.1.as_deref().unwrap_or_default()))
        })
}
