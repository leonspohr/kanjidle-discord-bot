export interface ResPuzzle {
  hints: ResHint[];
  extra_hints: ResHint[];
  answer: string;
  answer_meta: ResKanjiMeta;
  difficulty: Difficulty;
}

export interface ResHint {
  answer: Loc;
  hint: string;
}

export interface ResKanjiMeta {
  level: string;
  class: string;
  stroke_count: number;
  radical: string;
  on: string[];
  kun: ([string] | [string, string])[];
}

export enum Loc {
  L = "L",
  R = "R",
}

export enum Seed {
  Today = "today",
  Random = "random",
}

export enum Mode {
  Classic = "classic",
  Hidden = "hidden",
}

export enum Difficulty {
  Simple = "simple",
  Easy = "easy",
  Normal = "normal",
  Hard = "hard",
  Lunatic = "lunatic",
}

export async function fetchPuzzle(
  seed: Seed.Today,
  mode: Mode,
): Promise<ResPuzzle>;

export async function fetchPuzzle(
  seed: Seed.Random,
  mode: Mode,
  difficulty: Difficulty,
): Promise<ResPuzzle>;

export async function fetchPuzzle(
  seed: Seed,
  mode: Mode,
  difficulty?: Difficulty,
): Promise<ResPuzzle> {
  const r = await fetch(
    `${import.meta.env.VITE_API_URL}/v1/${seed}?mode=${mode}` +
      (difficulty ? `&difficulty=${difficulty}` : ""),
    {
      method: "GET",
    },
  );
  return (await r.json()) as ResPuzzle;
}

export function pretty(hints: ResHint[], answer?: string): string {
  return hints
    .map((h) =>
      h.answer == Loc.L
        ? `${answer ?? "◯"}${h.hint}`
        : `${h.hint}${answer ?? "◯"}`,
    )
    .join("　");
}
