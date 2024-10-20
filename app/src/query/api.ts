export interface ResPuzzle {
  hints: ResHint[];
  extra_hints: ResHint[];
  answer: string;
}

export interface ResHint {
  answer: Loc;
  hint: string;
}

export enum Loc {
  L = "L",
  R = "R",
}

export async function fetchToday(): Promise<ResPuzzle> {
  const r = await fetch(
    import.meta.env.VITE_API_URL + "/v1/today?difficulty=hard&mode=hidden",
    {
      method: "GET",
    }
  );
  return (await r.json()) as ResPuzzle;
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
