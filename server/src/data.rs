use std::{
    collections::{BTreeMap, HashMap},
    fmt::Display,
    fs::File,
    io::{BufRead, BufReader, BufWriter, Write},
    sync::LazyLock,
};

use anyhow::Result;
use indexmap::IndexMap;
use itertools::Itertools;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Deserializer;

static ASSET_KANJIS: &str = "assets/wikipedia_kanjis.csv";
static ASSET_KANJI_METAS: &str = "assets/kanjiten.jsonl";
static ASSET_KANJI_RADICALS: &str = "assets/radicals.json";
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
struct RawMeta {
    kanji: Ji,
    radical: Vec<Ji>,
    strokes: RawStrokes,
    #[serde(default)]
    on: Vec<RawOn>,
    #[serde(default)]
    kun: Vec<RawKun>,
    #[serde(default)]
    kanken: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawStrokes(usize, Vec<(String, usize, usize)>);

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawOn(String, #[serde(default)] Option<String>);

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawKun(RawInnerKun, #[serde(default)] Option<String>);

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawInnerKun(String, #[serde(default)] Option<String>);

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RawRadical(Vec<String>, Vec<String>);

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

    let file_radicals = File::open(ASSET_KANJI_RADICALS)?;
    let radicals = serde_json::from_reader::<_, BTreeMap<Ji, RawRadical>>(file_radicals)?;

    let file_metas = File::open(ASSET_KANJI_METAS)?;
    let rdr = BufReader::new(file_metas);
    let stream = Deserializer::from_reader(rdr);
    let kanji_metas = stream
        .into_iter::<RawMeta>()
        .filter_map_ok(|raw| {
            Some((
                raw.kanji,
                (KanjiMeta {
                    class: match &*raw.kanken {
                        "10" | "09" | "08" | "07" | "06" | "05" => KanjiClass::Kyoiku,
                        "04" | "03" | "02j" | "02" => KanjiClass::Joyo,
                        "01j" | "01" | "0101j" => KanjiClass::Kentei,
                        _ => KanjiClass::All,
                    },
                    level: raw.kanken,
                    stroke_count: raw.strokes.0,
                    radical: radicals.get(&raw.radical[0]).unwrap().0.join("・"),
                    on: raw.on.into_iter().map(|on| on.0).collect(),
                    kun: raw
                        .kun
                        .into_iter()
                        .map(|kun| Kun(kun.0 .0, kun.0 .1))
                        .collect(),
                }),
            ))
        })
        .map(|x| x.map_err(anyhow::Error::from))
        .collect::<Result<IndexMap<_, _>>>()?;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Loc {
    L,
    R,
}

pub static TWO_KANJI: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\p{Han})(\p{Han})$").unwrap());

pub static TWO_KANJI_IN_STRING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""(\p{Han}\p{Han})""#).unwrap());

pub static JMDICT_KANJI_PLACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""kanji"(.+?)"kana""#).unwrap());

pub static JMDICT_KANA_PLACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#""kana"(.+?)"sense""#).unwrap());

pub static JMDICT_KANA_INFO: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#""text":"([\p{Hiragana}\p{Katakana}ー]+)".+?"appliesToKanji":\[(.*?)\]"#).unwrap()
});

static ESTIMATED_JMDICT_SIZE: usize = 1_000_000;

pub static ESTIMATED_RANK_MAX: usize = 400_000;

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
        let mut known_words = HashMap::<String, Compound2>::with_capacity(ESTIMATED_JMDICT_SIZE);
        known_words.extend(
            rdr.lines()
                .filter_map(|str| {
                    let str = str.ok()?;
                    let (_, [place]) = JMDICT_KANJI_PLACE.captures(&str)?.extract();
                    let mut xs = TWO_KANJI_IN_STRING
                        .captures_iter(place)
                        .map(|m| (m.extract::<1>().1[0].to_owned(), None))
                        .collect::<BTreeMap<_, Option<String>>>();

                    let (_, [place]) = JMDICT_KANA_PLACE.captures(&str)?.extract();
                    for k in JMDICT_KANA_INFO.captures_iter(place) {
                        let (_, [reading, applies_to_kanji]) = k.extract();
                        if applies_to_kanji.contains("*") {
                            for v in xs.values_mut() {
                                v.get_or_insert(reading.to_string());
                            }
                        } else {
                            for y in TWO_KANJI_IN_STRING.captures_iter(applies_to_kanji) {
                                xs.get_mut(y.extract::<1>().1[0])
                                    .unwrap()
                                    .get_or_insert(reading.to_string());
                            }
                        }
                    }

                    Some(xs.into_iter().flat_map(|k| {
                        k.1.into_iter().filter_map(move |r| {
                            let word = Word {
                                rank: ESTIMATED_RANK_MAX,
                                text: k.0.clone(),
                                reading: r,
                            };
                            Some((k.0.clone(), extract_compound2(word, kanji_data)?))
                        })
                    }))
                })
                .flatten(),
        );
        known_words.shrink_to_fit();

        let mut twos = IndexMap::new();

        let mut rdr = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .from_path(ASSET_WORDS)?;
        for x in rdr.records() {
            let x = x?;
            let two = (|| {
                let word = Word {
                    text: x.get(0)?.into(),
                    reading: x.get(1)?.into(),
                    rank: x.get(2)?.parse().ok()?,
                };
                if !known_words.contains_key(&word.text) {
                    None
                } else {
                    extract_compound2(word, kanji_data)
                }
            })();
            if let Some(two) = two {
                if !twos.contains_key(&two.word.text) {
                    twos.insert(two.word.text.clone(), two);
                }
            }
        }
        for x in known_words {
            if !twos.contains_key(&x.0) {
                twos.insert(x.0, x.1);
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

fn extract_compound2(word: Word, kanji_data: &KanjiData) -> Option<Compound2> {
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
