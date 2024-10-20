use std::ops::Range;
use std::time::Instant;

use data::{Kanji, Word};
use indexmap::IndexMap;
use itertools::Itertools;
use ordered_float::OrderedFloat;

use crate::data::{self, KanjiClass, Loc, WordData};

#[derive(Debug, Clone)]
pub struct PuzzleOptions {
    // Kanji picking options
    pub kanji_class: KanjiClass,
    pub rare_kanji_rank: usize,
    pub rare_kanji_bias: f64,

    // Hint picking options
    pub word_rarity_range: Range<usize>,

    // Hint ordering options
    pub irregular_hint_bias: f64,
    pub rare_kanji_hint_rank: usize,
    pub rare_kanji_hint_bias: f64,
    pub rare_word_hint_rank: usize,
    pub rare_word_hint_bias: f64,

    // Puzzle size options
    pub num_hints: usize,
    pub guarantee_answer_by: usize,
}

#[derive(Debug, Clone)]
pub struct Hint {
    pub word: Word,
    pub answer: Kanji,
    pub answer_location: Loc,
    pub hint: Kanji,
    pub irregular: bool,
}

#[derive(Debug, Clone)]
pub struct Puzzle {
    pub answer: Kanji,
    pub hints: Vec<Hint>,
    pub extra_hints: Vec<Hint>,
}

#[derive(Debug, Clone)]
pub struct Generator<'a, R> {
    pub rng: R,
    pub kanjis: &'a IndexMap<String, Kanji>,
    pub word_data: &'a WordData,
}

impl<'a, R> Generator<'a, R> {
    pub fn new(
        rng: R,
        kanjis: &'a IndexMap<String, Kanji>,
        word_data: &'a WordData,
    ) -> Generator<'a, R> {
        Generator {
            rng,
            kanjis,
            word_data,
        }
    }
}

impl<'g, R: rand::Rng> Generator<'g, R> {
    pub fn choose_puzzle(&'g mut self, options: &PuzzleOptions) -> Puzzle {
        let start = Instant::now();
        let ks = self.choose_kanji(options);
        let t = start.elapsed();
        tracing::debug!("Chose kanjis in {t:?}");

        let start1 = Instant::now();
        for answer in ks {
            let start = Instant::now();
            let hints = self.find_usable_hints(&answer, options);
            let puzzle: Option<Puzzle> = self.choose_puzzle_from(&answer, &hints, options);
            let t = start.elapsed();
            tracing::debug!("Checked hints in {t:?}");

            if let Some(p) = puzzle {
                let t = start1.elapsed();
                tracing::debug!("Chose final puzzle in {t:?}");
                return p;
            }
        }
        panic!("Could not generate a puzzle, this should not occur")
    }

    pub fn choose_kanji(&mut self, options: &PuzzleOptions) -> Vec<Kanji> {
        let ks = self
            .kanjis
            .values()
            .filter(|k| k.meta.class <= options.kanji_class)
            .collect_vec();
        weighted_shuffle(&ks, &mut self.rng, |k| {
            if k.rank > options.rare_kanji_rank {
                options.rare_kanji_bias
            } else {
                1.0
            }
        })
        .map(|k| (*k).clone())
        .collect()
    }

    pub fn find_usable_hints(&mut self, answer: &Kanji, options: &PuzzleOptions) -> Vec<Hint> {
        self.word_data
            .twos
            .iter()
            .skip_while(|x| x.word.rank < options.word_rarity_range.start)
            .take_while(|x| x.word.rank < options.word_rarity_range.end)
            .filter_map(|two| {
                let (hint, answer, answer_location) = if *two.a.text == answer.text {
                    (two.b.clone(), two.a.clone(), Loc::L)
                } else if *two.b.text == answer.text {
                    (two.a.clone(), two.b.clone(), Loc::R)
                } else {
                    return None;
                };
                Some(Hint {
                    word: two.word.clone(),
                    hint,
                    answer_location,
                    answer,
                    irregular: two.irregular,
                })
            })
            .collect()
    }

    pub fn choose_puzzle_from(
        &mut self,
        answer: &Kanji,
        hints: &[Hint],
        options: &PuzzleOptions,
    ) -> Option<Puzzle> {
        if hints.len() < options.num_hints {
            return None;
        }

        let mut splits: Vec<Vec<_>> = split(&hints.iter().rev().collect_vec(), options.num_hints)
            .map(|s| s.to_vec())
            .collect();
        for split in &mut splits {
            *split = weighted_shuffle(split, &mut self.rng, |x| {
                let b1 = if x.irregular {
                    options.irregular_hint_bias
                } else {
                    1.0
                };
                let b2 = if x.hint.rank > options.rare_kanji_hint_rank {
                    options.rare_kanji_hint_bias
                } else {
                    1.0
                };
                let b3 = if x.word.rank >= options.rare_word_hint_rank {
                    options.rare_word_hint_bias
                } else {
                    1.0
                };
                b1 * b2 * b3
            })
            .copied()
            .collect();
        }
        let splits = splits;

        let guaranteed_hints = &splits[0..options.guarantee_answer_by];
        for ixes in
            multi_cartesian_diagonal(&guaranteed_hints.iter().map(|s| s.len()).collect_vec())
        {
            let chosen_hints = guaranteed_hints
                .iter()
                .zip(ixes)
                .map(|(s, ix)| s[ix])
                .collect_vec();
            if self
                .find_unintended_solutions(answer, &chosen_hints)
                .is_empty()
            {
                return Some(Puzzle {
                    answer: answer.clone(),
                    hints: chosen_hints.iter().copied().cloned().collect(),
                    extra_hints: splits[options.guarantee_answer_by..options.num_hints]
                        .iter()
                        .map(|s| s[0].clone())
                        .collect(),
                });
            }
        }

        None
    }

    pub fn find_unintended_solutions(&self, answer: &Kanji, hints: &[&Hint]) -> Vec<&Kanji> {
        self.kanjis
            .values()
            .filter(|k| {
                k.text != answer.text
                    && hints.iter().all(|x| match x.answer_location {
                        Loc::L => {
                            let key = k.text.clone() + &x.hint.text;
                            self.word_data.keys.contains(&key)
                        }
                        Loc::R => {
                            let key = x.hint.text.clone() + &k.text;
                            self.word_data.keys.contains(&key)
                        }
                    })
            })
            .collect()
    }
}

// https://users.rust-lang.org/t/how-to-split-a-slice-into-n-chunks/40008/3
fn split<T>(slice: &[T], n: usize) -> impl Iterator<Item = &[T]> {
    struct Split<'a, T> {
        slice: &'a [T],
        len: usize,
        rem: usize,
    }

    impl<'a, T> Iterator for Split<'a, T> {
        type Item = &'a [T];

        fn next(&mut self) -> Option<Self::Item> {
            if self.slice.is_empty() {
                return None;
            }
            let mut len = self.len;
            if self.rem > 0 {
                len += 1;
                self.rem -= 1;
            }
            let (chunk, rest) = self.slice.split_at(len);
            self.slice = rest;
            Some(chunk)
        }
    }
    let len = slice.len() / n;
    let rem = slice.len() % n;
    Split { slice, len, rem }
}

fn weighted_shuffle<'a, T, R: rand::Rng, F: Fn(&T) -> f64>(
    items: &'a [T],
    rng: &mut R,
    weight: F,
) -> impl Iterator<Item = &'a T> {
    (0..items.len())
        .map(|i| (i, -rng.gen::<f64>().powf(1.0 / weight(&items[i]))))
        .sorted_by_key(|x| OrderedFloat(x.1))
        .map(|x| &items[x.0])
}

// Iterate through the indices of an n-dimensional matrix in diagonal order.
fn multi_cartesian_diagonal(dims: &[usize]) -> impl Iterator<Item = Vec<usize>> + use<'_> {
    fn step<'b>(i: usize, dims: &'b [usize]) -> Box<dyn Iterator<Item = Vec<usize>> + 'b> {
        if dims.len() == 1 {
            if i < dims[0] {
                Box::new(std::iter::once(vec![i]))
            } else {
                Box::new(std::iter::empty())
            }
        } else {
            Box::new(
                (0..=i).flat_map(move |j| -> Box<dyn Iterator<Item = Vec<usize>> + 'b> {
                    let i = i - j;
                    if i < dims[0] {
                        Box::new(step(j, &dims[1..]).map(move |mut ix| {
                            let mut a = vec![i];
                            a.append(&mut ix);
                            a
                        }))
                    } else {
                        Box::new(std::iter::empty())
                    }
                }),
            )
        }
    }

    (0..=dims.iter().sum()).flat_map(|i| step(i, dims))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shuffle_obvious() {
        let out = weighted_shuffle(&[100, 0], &mut rand::thread_rng(), |x| *x as f64);
        assert_eq!(out.collect_vec(), vec![&100, &0]);
    }

    fn cartesian_diagonal(n1: usize, n2: usize) -> impl Iterator<Item = Vec<usize>> {
        (0..=n1 + n2).flat_map(move |i| {
            (0..=i).filter_map(move |j| {
                let i = i - j;
                if i < n1 && j < n2 {
                    Some(vec![i, j])
                } else {
                    None
                }
            })
        })
    }

    #[test]
    fn multi_cartesian_diagonal_2d() {
        let ixes1 = cartesian_diagonal(3, 4).collect_vec();
        assert_eq!(ixes1.len(), 3 * 4);
        assert!(ixes1
            .iter()
            .tuple_windows()
            .all(|(a, b)| a.iter().sum::<usize>() <= b.iter().sum()));
        assert_eq!(
            ixes1.iter().map(|x| x.iter().sum()).counts(),
            [(0, 1), (1, 2), (2, 3), (3, 3), (4, 2), (5, 1)].into()
        );

        let ixes2 = multi_cartesian_diagonal(&[3, 4]).collect_vec();
        assert_eq!(ixes1, ixes2);
    }

    fn cartesian_diagonal_3d(n1: usize, n2: usize, n3: usize) -> impl Iterator<Item = Vec<usize>> {
        (0..=n1 + n2 + n3).flat_map(move |i| {
            (0..=i).flat_map(move |j| {
                let i = i - j;
                (0..=j).filter_map(move |k| {
                    let j = j - k;
                    if i < n1 && j < n2 && k < n3 {
                        Some(vec![i, j, k])
                    } else {
                        None
                    }
                })
            })
        })
    }

    #[test]
    fn multi_cartesian_diagonal_3d() {
        let ixes1 = cartesian_diagonal_3d(3, 4, 5).collect_vec();
        assert_eq!(ixes1.len(), 3 * 4 * 5);
        assert!(ixes1
            .iter()
            .tuple_windows()
            .all(|(a, b)| a.iter().sum::<usize>() <= b.iter().sum()));
        assert_eq!(
            ixes1.iter().map(|x| x.iter().sum()).counts(),
            [
                (0, 1),
                (1, 3),
                (2, 6),
                (3, 9),
                (4, 11),
                (5, 11),
                (6, 9),
                (7, 6),
                (8, 3),
                (9, 1)
            ]
            .into()
        );

        let ixes2 = multi_cartesian_diagonal(&[3, 4, 5]).collect_vec();
        assert_eq!(ixes1, ixes2);
    }

    #[test]
    #[allow(clippy::identity_op)]
    fn multi_cartesian_diagonal_nd() {
        let ixes = multi_cartesian_diagonal(&[3, 4, 5, 2, 1, 10]).collect_vec();
        assert_eq!(ixes.len(), 3 * 4 * 5 * 2 * 1 * 10);
        assert!(ixes
            .iter()
            .tuple_windows()
            .all(|(a, b)| a.iter().sum::<usize>() <= b.iter().sum()));
    }
}
