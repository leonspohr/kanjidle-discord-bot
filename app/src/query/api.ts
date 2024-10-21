export interface ResPuzzleHidden {
  hints: ResHint[];
  extra_hints: ResHint[];
  answer: string;
  difficulty: Difficulty;
}

export interface ResHint {
  answer: Loc;
  hint: string;
}

export enum Loc {
  L = "L",
  R = "R",
}

export enum Difficulty {
  Simple = "simple",
  Easy = "easy",
  Normal = "normal",
  Hard = "hard",
  Lunatic = "lunatic",
}

export async function fetchToday(): Promise<ResPuzzleHidden> {
  const r = await fetch(
    import.meta.env.VITE_API_URL + "/v1/today?mode=hidden",
    {
      method: "GET",
    }
  );
  return (await r.json()) as ResPuzzleHidden;
}

export function pretty(hints: ResHint[], answer?: string): string {
  return hints
    .map((h) =>
      h.answer == Loc.L
        ? `${answer ?? "◯"}${h.hint}`
        : `${h.hint}${answer ?? "◯"}`
    )
    .join("　");
}

export function diffName(d: Difficulty): string {
  switch (d) {
    case Difficulty.Simple:
      return "絵本級・Simple";
    case Difficulty.Easy:
      return "童話級・Easy";
    case Difficulty.Normal:
      return "漫画級・Normal";
    case Difficulty.Hard:
      return "芝居級・Hard";
    case Difficulty.Lunatic:
      return "奇譚級・Lunatic";
  }
}
