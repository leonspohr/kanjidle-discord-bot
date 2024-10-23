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
    <div className="grid select-none grid-cols-coin grid-rows-coin place-items-center grid-areas-coin">
      {puzzle.hints.concat(puzzle.extra_hints).map((w, i) => (
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
            "text-2xl",
            result === Result.None && showExtra + 4 <= i && "blur",
            "transition-all duration-300 ease-in-out",
          )}
        >
          {result === Result.None && showExtra + 4 <= i
            ? "╲╱╲╱"[i - 4]
            : w.answer === Loc.L
              ? "↑→↓←↖↗↘↙"[i]
              : "↓←↑→↘↙↖↗"[i]}
        </div>
      ))}
      {puzzle.hints.concat(puzzle.extra_hints).map((w, i) => (
        <a
          key={w.hint + w.answer}
          {...(result === Result.None
            ? {}
            : {
                href: `https://kotobank.jp/search?t=ja&q=${
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
              "place-self-end grid-in-w5",
              "self-end justify-self-start grid-in-w6",
              "place-self-start grid-in-w7",
              "self-start justify-self-end grid-in-w8",
            ][i],
            "text-4xl",
            result !== Result.None && "text-blue-500 underline",
            result === Result.None && showExtra + 4 <= i && "blur",
            "transition-all duration-300 ease-in-out",
          )}
        >
          {result === Result.None && showExtra + 4 <= i ? "何" : w.hint}
          <span> </span>
        </a>
      ))}
      <a
        {...(result === Result.None
          ? {}
          : {
              href: `https://kanji.jitenon.jp/cat/search?search=contain&how=すべて&getdata=${puzzle.answer
                .codePointAt(0)
                ?.toString(16)}`,
            })}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          "text-5xl grid-in-qq",
          result === Result.Win && "text-green-600 underline",
          result === Result.Lose && "text-red-600 underline",
        )}
      >
        {result === Result.None ? "？" : puzzle.answer}&#x000A;
      </a>
    </div>
  );
}
