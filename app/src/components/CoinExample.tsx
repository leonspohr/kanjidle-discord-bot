import clsx from "clsx";
import { Loc, ResHint } from "../query/api";

export interface CoinExampleProps {
  puzzle: { hints: ResHint[]; extra_hints: ResHint[] };
  showExtra: number;
}

export default function CoinExample({ puzzle, showExtra }: CoinExampleProps) {
  return (
    <div className="grid grid-areas-coin grid-cols-coin-example grid-rows-coin-example place-items-center select-none">
      {puzzle.hints.concat(puzzle.extra_hints).map((w, i) => (
        <div
          key={w.hint + w.answer}
          className={clsx(
            [
              "grid-in-a1",
              "grid-in-a2",
              "grid-in-a3",
              "grid-in-a4",
              "grid-in-a5 translate-x-1.5 translate-y-1.5",
              "grid-in-a6 -translate-x-1.5 translate-y-1.5",
              "grid-in-a7 -translate-x-1.5 -translate-y-1.5",
              "grid-in-a8 translate-x-1.5 -translate-y-1.5",
            ][i],
            "text-lg",
            showExtra + 4 <= i && "blur",
            "transition-all ease-in-out duration-300"
          )}
        >
          {showExtra + 4 <= i
            ? "╲╱╲╱"[i - 4]
            : w.answer === Loc.L
            ? "↑→↓←↖↗↘↙"[i]
            : "↓←↑→↘↙↖↗"[i]}
        </div>
      ))}
      {puzzle.hints.concat(puzzle.extra_hints).map((w, i) => (
        <div
          key={w.hint + w.answer}
          className={clsx(
            [
              "grid-in-w1",
              "grid-in-w2",
              "grid-in-w3",
              "grid-in-w4",
              "grid-in-w5 place-self-end",
              "grid-in-w6 justify-self-start self-end",
              "grid-in-w7 place-self-start",
              "grid-in-w8 justify-self-end self-start",
            ][i],
            "text-xl",
            showExtra + 4 <= i && "blur",
            "transition-all ease-in-out duration-300"
          )}
        >
          {showExtra + 4 <= i ? "何" : w.hint}
          <span> </span>
        </div>
      ))}
      <div className="grid-in-qq text-xl">？&#x000A;</div>
    </div>
  );
}
