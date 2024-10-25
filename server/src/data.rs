use std::{
    collections::{BTreeMap, HashSet},
    fmt::Display,
    fs::File,
    io::{BufRead, BufReader, BufWriter, Write},
    sync::LazyLock,
};

use anyhow::Result;
use indexmap::IndexMap;
use itertools::Itertools;
use kana;
use regex::Regex;
use serde::{Deserialize, Serialize};

static ASSET_KANJIS: &str = "assets/wikipedia_kanjis.csv";
static ASSET_KANJI_METAS: &str = "assets/kanjiten.json";
static ASSET_WORDS: &str = "assets/jpdb_words.csv";
static ASSET_DICTIONARY: &str = "assets/jmdict.json";

static GENERATED_KANJIS: &str = "generated/kanjis.csv";
static GENERATED_KANJI_METAS: &str = "generated/kanji_metas.json";
static GENERATED_WORDS: &str = "generated/words.csv";

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(transparent)]
pub struct Ji(pub char);

impl From<char> for Ji {
    fn from(value: char) -> Self {
        Ji(value)
    }
}

impl From<Ji> for char {
    fn from(val: Ji) -> Self {
        val.0
    }
}

impl Display for Ji {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Kanji {
    pub ji: Ji,
    pub rank: usize,
    pub count: usize,
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

#[derive(Debug, Deserialize)]
struct KanjiMetaRaw {
    ji: Ji,
    on: String,
    kun: String,
    tags: String,
    _desc: Vec<String>,
    meta: BTreeMap<String, String>,
}

#[derive(Debug)]
pub struct KanjiData {
    pub kanjis: IndexMap<Ji, Kanji>,
    pub kanji_metas: IndexMap<Ji, KanjiMeta>,
}

pub fn load_kanjis() -> Result<KanjiData> {
    if let (Ok(file_kanjis), Ok(file_kanji_metas)) = (
        File::open(GENERATED_KANJIS),
        File::open(GENERATED_KANJI_METAS),
    ) {
        tracing::info!("Reading kanjis and kanji metas from generated files...");

        let mut reader = csv::Reader::from_reader(file_kanjis);
        let kanjis = reader
            .deserialize::<Kanji>()
            .process_results(|iter| iter.map(|k| (k.ji, k)).collect())?;

        let kanji_metas = serde_json::from_reader(file_kanji_metas)?;

        return Ok(KanjiData {
            kanjis,
            kanji_metas,
        });
    }

    let mut rdr = csv::Reader::from_path(ASSET_KANJIS)?;
    let kanjis = rdr
        .records()
        .skip(1)
        .filter_map_ok(|x| {
            let char = extract_only_char(x.get(2)?)?.into();
            Some((
                char,
                Kanji {
                    ji: char,
                    rank: x.get(0)?.parse().ok()?,
                    count: x.get(3)?.parse().ok()?,
                },
            ))
        })
        .map(|x| x.map_err(anyhow::Error::from))
        .collect::<Result<IndexMap<_, _>>>()?;

    let meta_file = File::open(ASSET_KANJI_METAS)?;
    let json: Vec<KanjiMetaRaw> = serde_json::from_reader(meta_file)?;
    let kanji_metas = json
        .iter()
        .filter_map(|raw| {
            Some((
                raw.ji,
                (KanjiMeta {
                    level: kana::wide2ascii(raw.tags.split_whitespace().last()?),
                    class: raw
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
                    stroke_count: kana::wide2ascii(raw.meta.get("画数")?.split("画").next()?)
                        .parse()
                        .ok()?,
                    radical: raw
                        .meta
                        .get("部首")?
                        .split("（")
                        .next()?
                        .split_whitespace()
                        .join("・"),
                    on: raw.on.split(" ").map(String::from).collect(),
                    kun: raw
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
                }),
            ))
        })
        .collect::<IndexMap<_, _>>();

    let kanjis = kanjis
        .into_iter()
        .filter(|k| kanji_metas.contains_key(&k.0))
        .collect::<IndexMap<_, _>>();

    let kanji_metas = kanji_metas
        .into_iter()
        .filter(|k| kanjis.contains_key(&k.0))
        .collect::<IndexMap<_, _>>();

    tracing::info!("Writing generated kanjis file...");
    let file = File::create(GENERATED_KANJIS)?;
    let mut writer = csv::Writer::from_writer(BufWriter::new(file));
    for kanji in kanjis.values() {
        writer.serialize(kanji)?;
    }
    writer.flush()?;

    tracing::info!("Writing generated kanji metas file...");
    let file = File::create(GENERATED_KANJI_METAS)?;
    let mut writer = BufWriter::new(file);
    serde_json::to_writer(&mut writer, &kanji_metas)?;
    writer.flush()?;

    Ok(KanjiData {
        kanjis,
        kanji_metas,
    })
}

pub static TWO_KANJI: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\p{Han})(\p{Han})$").unwrap());

pub static TWO_KANJI_IN_STRING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""(\p{Han}\p{Han})""#).unwrap());

pub static JMDICT_KANJI_PLACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""kanji"(.+?)"kana""#).unwrap());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Loc {
    L,
    R,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Word {
    pub text: String,
    pub reading: String,
    pub rank: usize,
}

#[derive(Debug)]
pub struct Compound2 {
    pub word: Word,
    pub a: Ji,
    pub b: Ji,
    pub irregular: bool,
}

#[derive(Debug)]
pub struct WordData {
    pub twos: IndexMap<String, Compound2>,
}

pub fn load_words(kanji_data: &KanjiData) -> Result<WordData> {
    let twos = if let Ok(file) = File::open(GENERATED_WORDS) {
        tracing::info!("Reading words from generated file...");
        let mut reader = csv::Reader::from_reader(file);
        reader.deserialize::<Word>().process_results(|iter| {
            iter.filter_map(|word| {
                let mut chars = word.text.chars();
                let a = chars.next()?.into();
                let b = chars.exactly_one().ok()?.into();
                Some((
                    word.text.clone(),
                    Compound2 {
                        a,
                        b,
                        irregular: is_reading_irregular(
                            &word.text,
                            kanji_data.kanji_metas.get(&a)?,
                            kanji_data.kanji_metas.get(&b)?,
                        ),
                        word,
                    },
                ))
            })
            .collect()
        })?
    } else {
        let file_dict = File::open(ASSET_DICTIONARY)?;
        let rdr = BufReader::new(file_dict);
        let mut known_words = HashSet::<String>::with_capacity(1_000_000);
        known_words.extend(
            rdr.lines()
                .filter_map(|str| {
                    let str = str.ok()?;
                    let (_, [place]) = JMDICT_KANJI_PLACE.captures(&str)?.extract();
                    let xs = TWO_KANJI_IN_STRING
                        .captures_iter(place)
                        .map(|m| m.extract::<1>().1[0].to_owned())
                        .collect_vec();
                    Some(xs)
                })
                .flatten(),
        );
        known_words.shrink_to_fit();

        let mut rdr = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .from_path(ASSET_WORDS)?;
        let mut twos = IndexMap::new();
        for x in rdr.records() {
            let x = x?;
            let two = (|| {
                let word = Word {
                    text: x.get(0)?.into(),
                    reading: x.get(1)?.into(),
                    rank: x.get(2)?.parse().ok()?,
                };
                if !known_words.contains(&word.text) {
                    None
                } else {
                    let (_, [a, b]) = TWO_KANJI.captures(&word.text)?.extract();
                    if a == b || b == "々" {
                        None
                    } else {
                        let a = extract_only_char(a)?.into();
                        let b = extract_only_char(b)?.into();
                        Some(Compound2 {
                            a,
                            b,
                            irregular: is_reading_irregular(
                                &word.text,
                                kanji_data.kanji_metas.get(&a)?,
                                kanji_data.kanji_metas.get(&b)?,
                            ),
                            word,
                        })
                    }
                }
            })();
            if let Some(two) = two {
                if !twos.contains_key(&two.word.text) {
                    twos.insert(two.word.text.clone(), two);
                }
            }
        }
        tracing::info!("Writing generated words file...");
        let file = File::create(GENERATED_WORDS)?;
        let mut writer = csv::Writer::from_writer(BufWriter::new(file));
        for two in twos.values() {
            writer.serialize(&two.word)?;
        }
        writer.flush()?;

        twos
    };

    Ok(WordData { twos })
}

// Very rudimentary method of doing this but it should be fine
// Completely ignores things like okurigana and sound changes
// And only works on 2-character compounds
fn is_reading_irregular(word: &str, a: &KanjiMeta, b: &KanjiMeta) -> bool {
    a.on.iter().any(|r| word.starts_with(r))
        || a.kun.iter().any(|r| {
            word.starts_with(&r.0)
                || word.starts_with(&(r.0.clone() + r.1.as_deref().unwrap_or_default()))
        })
        || b.on.iter().any(|r| word.ends_with(r))
        || b.kun.iter().any(|r| {
            word.ends_with(&r.0)
                || word.ends_with(&(r.0.clone() + r.1.as_deref().unwrap_or_default()))
        })
}

fn extract_only_char(x: &str) -> Option<char> {
    x.chars().exactly_one().ok()
}
