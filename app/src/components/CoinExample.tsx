import clsx from "clsx";

import { Loc, ResHint } from "../query/api";

export interface CoinExampleProps {
  puzzle: { hints: ResHint[]; extra_hints?: ResHint[] };
  showExtra: number;
}

export default function CoinExample({ puzzle, showExtra }: CoinExampleProps) {
  return (
    <div className="grid select-none grid-cols-coin-example grid-rows-coin-example place-items-center grid-areas-coin">
      {puzzle.hints.concat(puzzle?.extra_hints ?? []).map((w, i) => (
        <div
          key={w.hint + w.answer}
          className={clsx(
            [
              "grid-in-a1",
              "grid-in-a2",
              "grid-in-a3",
              "grid-in-a4",
              "translate-x-1.5 translate-y-1.5 grid-in-a5",
              "-translate-x-1.5 translate-y-1.5 grid-in-a6",
              "-translate-x-1.5 -translate-y-1.5 grid-in-a7",
              "-translate-y-1.5 translate-x-1.5 grid-in-a8",
            ][i],
            "text-lg",
            showExtra + 4 <= i && "blur",
            "transition-all duration-300 ease-in-out",
          )}
        >
          {showExtra + 4 <= i
            ? "╲╱╲╱"[i - 4]
            : w.answer === Loc.L
              ? "↑→↓←↖↗↘↙"[i]
              : "↓←↑→↘↙↖↗"[i]}
        </div>
      ))}
      {puzzle.hints.concat(puzzle?.extra_hints ?? []).map((w, i) => (
        <div
          key={w.hint + w.answer}
          className={clsx(
            [
              "grid-in-w1",
              "grid-in-w2",
              "grid-in-w3",
              "grid-in-w4",
              "place-self-end grid-in-w5",
              "self-end justify-self-start grid-in-w6",
              "place-self-start grid-in-w7",
              "self-start justify-self-end grid-in-w8",
            ][i],
            "text-xl",
            showExtra + 4 <= i && "blur",
            "transition-all duration-300 ease-in-out",
          )}
        >
          {showExtra + 4 <= i ? "何" : w.hint}
          <span> </span>
        </div>
      ))}
      <div className="text-xl grid-in-qq">？&#x000A;</div>
    </div>
  );
}
