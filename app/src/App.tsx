import { useQuery } from "@tanstack/react-query";
import { diffName, fetchToday } from "./query/api";
import { useEffect, useState } from "react";
import Coin from "./components/Coin";
import { Result } from "./Result";
import { DateTime } from "ts-luxon";
import CoinPlaceholder from "./components/CoinPlaceholder";
import confetti from "canvas-confetti";
import {
  useJSONLocalStorage,
  useParsedLocalStorage,
} from "./hooks/useLocalStorage";
import clsx from "clsx";

function App() {
  const query = useQuery({
    queryKey: ["classic", "today"],
    queryFn: () => fetchToday(),
    staleTime: Infinity,
  });

  const [attempts, setAttempts] = useJSONLocalStorage<(string | null)[]>(
    "attempts",
    []
  );

  const [result, setResult] = useJSONLocalStorage<Result>(
    "result",
    Result.None
  );

  const [guess, setGuess] = useState("");

  const [diff, setDiff] = useState<string>(
    DateTime.utc()
      .startOf("day")
      .plus({ days: 1 })
      .diffNow(["hours", "minutes", "seconds"])
      .toFormat("hh:mm:ss")
  );

  useEffect(() => {
    if (result !== Result.None) {
      const interval = setInterval(() => {
        const diff = DateTime.utc()
          .startOf("day")
          .plus({ days: 1 })
          .diffNow(["hours", "minutes", "seconds"]);
        setDiff(diff.toFormat("hh:mm:ss"));
        if (diff.toMillis() <= 0) {
          window.location.reload();
        }
      }, 1_000);
      return () => clearInterval(interval);
    }
  }, [result]);

  const [lastPlayed, setLastPlayed] = useParsedLocalStorage(
    "lastPlayed",
    DateTime.utc().startOf("day"),
    (s) => DateTime.fromMillis(Number(s), { zone: "utc" }),
    (v) => v.toMillis().toString()
  );

  useEffect(() => {
    if (+lastPlayed.startOf("day") !== +DateTime.utc().startOf("day")) {
      setAttempts([]);
      setResult(Result.None);
      setLastPlayed(DateTime.utc().startOf("day"));
    }
    // Want this to run only on mount for the time change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!query.isPending && !query.isError) {
      if (result === Result.Lose) {
        loseConfetti();
      } else if (result === Result.Win) {
        winConfetti();
      }
    }
  }, [query.isError, query.isPending, result]);

  return (
    <div className="flex flex-col container mx-auto my-4 justify-center items-center gap-4 text-2xl lg:text-3xl xl:text-4xl">
      {query.isPending ? (
        <>
          <div className="h-[6ch]"></div>
          <p className="text-sm">
            {DateTime.utc().toFormat("yyyy-LL-dd")}&#x3000;
            <span className="blur-sm">何々級・Load</span>
          </p>
          <CoinPlaceholder />
          <span>読込中</span>
        </>
      ) : query.isError ? (
        <>
          <div className="h-[6ch]"></div>
          <p className="text-sm">
            {DateTime.utc().toFormat("yyyy-LL-dd")}&#x3000;
            <span className="blur-sm">何々級・Load</span>
          </p>
          <CoinPlaceholder />
          <span className="text-red-600">エラー</span>
          <span className="font-mono text-sm">{query.error.message}</span>
        </>
      ) : (
        <>
          <div className="flex flex-col h-[6ch] justify-center items-center gap-4">
            {result !== Result.None && (
              <>
                <p className="text-sm text-center mx-4">
                  次のパズルは
                  {diff}後
                </p>
                <button
                  className="bg-inherit border enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 border-zinc-600 disabled:border-stone-600 rounded-lg w-[14ch] h-[3ch] text-center"
                  onClick={() => {
                    void window.navigator.clipboard.writeText(
                      `Kanjidle (Beta) ${DateTime.utc().toFormat(
                        "yyyy-LL-dd"
                      )} ${
                        result === Result.Lose ? "X" : attempts.length
                      }/5\n` +
                        score(attempts.length, result) +
                        `\nhttps://kanjidle.onecomp.one`
                    );
                  }}
                >
                  {result === Result.Lose ? "X" : attempts.length}
                  /5 コピーする
                </button>
              </>
            )}
          </div>
          <p className="text-sm">
            {DateTime.utc().toFormat("yyyy-LL-dd")}&#x3000;
            {diffName(query.data.difficulty)}
          </p>
          <Coin
            puzzle={query.data}
            showExtra={attempts.length}
            result={result}
          />
          <form
            className="flex flex-row gap-4 justify-center items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (guess === query.data.answer) {
                setAttempts([...attempts, guess]);
                setGuess("　");
                setResult(Result.Win);
              } else if (guess !== query.data?.answer) {
                setAttempts([...attempts, guess]);
                setGuess("");
                if (attempts.length === 4) {
                  setGuess("　");
                  setResult(Result.Lose);
                }
              }
            }}
          >
            <div className="flex flex-row justify-center items-center">
              <input
                name="answer"
                type="text"
                autoComplete="off"
                className="z-10 border border-r-0 border-zinc-600 disabled:border-stone-600 bg-inherit rounded-md rounded-r-none w-[10ch] lg:w-[14ch] h-[3ch] text-center outline outline-2 outline-transparent focus:outline-blue-400 transition-colors ease-in-out duration-300"
                disabled={result !== Result.None}
                value={guess}
                placeholder="✏１文字"
                onChange={(e) => setGuess(e.target.value)}
              ></input>
              <button
                className="border text-emerald-600 border-emerald-600 enabled:hover:bg-emerald-600 enabled:hover:text-zinc-200 enabled:active:bg-emerald-600 disabled:text-stone-600 disabled:border-stone-600 bg-inherit rounded-md rounded-l-none w-[5ch] h-[3ch] text-center transition-colors ease-in-out duration-300"
                type="submit"
                disabled={
                  !/^\p{Script=Han}$/u.test(guess) ||
                  attempts.includes(guess) ||
                  result !== Result.None
                }
              >
                決定
              </button>
            </div>
            <button
              className="border text-rose-600 border-rose-600 enabled:hover:bg-rose-600 enabled:hover:text-zinc-200 enabled:active:bg-rose-600 disabled:text-stone-600 disabled:border-stone-600 bg-inherit rounded-md w-[8ch] h-[3ch] text-center transition-colors ease-in-out duration-300"
              type="button"
              disabled={result !== Result.None}
              onClick={() => {
                setAttempts([...attempts, null]);
                setGuess("");
                if (attempts.length === 4) {
                  setGuess("　");
                  setResult(Result.Lose);
                }
              }}
            >
              スキップ
            </button>
          </form>
          <div className="flex flex-row justify-start items-center h-[3ch] gap-6">
            {attempts.length ? (
              attempts.map((x, i) => (
                <div
                  key={String(x) + i}
                  className={clsx(
                    "flex flex-row justify-center items-center",
                    x === query.data.answer ? "text-green-600" : "text-red-600"
                  )}
                >
                  {x === query.data.answer ? (
                    <span className="scale-75">✔</span>
                  ) : (
                    <span className="-translate-y-0.5">⨯</span>
                  )}
                  {x ?? (
                    <div className="grid grid-rows-2 grid-cols-2 text-xs">
                      <div>ス</div>
                      <div>キ</div>
                      <div>ッ</div>
                      <div>プ</div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-600">
                回答とスキップはここに記録します
              </div>
            )}
          </div>
          <p className="text-base text-center mx-4">
            真ん中に漢字１文字を入れてすべての二字熟語を作ってください！
            <br />
            矢印は文字の順番を表します！例えば「◯←？」は「？◯」になります！
            <br />
            回答チャンスは５回！間違えるかスキップすると新しいヒントが出ます！
          </p>
        </>
      )}
    </div>
  );
}

export default App;

function score(attempts: number, result: Result): string {
  if (result === Result.Lose) {
    return "🟨🟨🟨\n🟨🟥🟨\n🟨🟨🟨";
  }
  switch (attempts) {
    case 1:
      return "⬛🟩⬛\n🟩✅🟩\n⬛🟩⬛";
    case 2:
      return "🟩🟨⬛\n🟨✅🟨\n⬛🟨⬛";
    case 3:
      return "🟨🟨🟩\n🟨✅🟨\n⬛🟨⬛";
    case 4:
      return "🟨🟨🟨\n🟨✅🟨\n⬛🟨🟩";
    case 5:
    default:
      return "🟨🟨🟨\n🟨✅🟨\n🟩🟨🟨";
  }
}

function winConfetti() {
  void confetti({
    particleCount: 300,
    angle: 90,
    spread: 120,
    startVelocity: 90,
    scalar: 2,
    ticks: 200,
    gravity: 1,
    origin: { x: 0.5, y: 1 },
  });
}

function loseConfetti() {
  void confetti({
    particleCount: 100,
    startVelocity: 70,
    spread: 360,
    scalar: 2,
    gravity: 0,
    ticks: 100,
    // @ts-expect-error outdated typings
    flat: true,
    shapes: ["circle"],
    colors: ["#e11d48"],
    origin: { x: 0.5, y: 0.5 },
  });
}
