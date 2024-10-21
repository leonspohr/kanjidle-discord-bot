import clsx from "clsx";
import { Loc, ResPuzzleHidden } from "../query/api";
import { Result } from "../Result";

export interface CoinProps {
  puzzle: ResPuzzleHidden;
  showExtra: number;
  result: Result;
}

export default function Coin({ puzzle, showExtra, result }: CoinProps) {
  return (
    <div className="grid grid-areas-coin grid-cols-coin grid-rows-coin place-items-center select-none">
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
            "text-2xl"
          )}
        >
          {result === Result.None && showExtra + 4 <= i ? (
            <span className="blur-sm">{"╲╱╲╱"[i - 4]}</span>
          ) : w.answer === Loc.L ? (
            "↑→↓←↖↗↘↙"[i]
          ) : (
            "↓←↑→↘↙↖↗"[i]
          )}
        </div>
      ))}
      {puzzle.hints.concat(puzzle.extra_hints).map((w, i) => (
        <a
          key={w.hint + w.answer}
          {...(result === Result.None
            ? {}
            : {
                href: `https://kotobank.jp/word/${
                  w.answer === Loc.L
                    ? puzzle.answer + w.hint
                    : w.hint + puzzle.answer
                }`,
              })}
          target="_blank"
          rel="noopener noreferrer"
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
            "text-4xl",
            result !== Result.None && "text-blue-500 underline"
          )}
        >
          {result === Result.None && showExtra + 4 <= i ? (
            <span className="blur">何</span>
          ) : (
            w.hint
          )}
          <span> </span>
        </a>
      ))}
      <div
        className={clsx(
          "grid-in-qq text-5xl",
          result === Result.Win && "text-green-600",
          result === Result.Lose && "text-red-600"
        )}
      >
        {result === Result.None ? "？" : puzzle.answer}&#x000A;
      </div>
    </div>
  );
}
