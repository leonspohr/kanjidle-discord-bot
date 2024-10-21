import { useQuery } from "@tanstack/react-query";
import { diffName, fetchToday } from "./query/api";
import { useEffect, useState } from "react";
import Coin from "./components/Coin";
import { Result } from "./Result";
import { DateTime } from "ts-luxon";
import CoinPlaceholder from "./components/CoinPlaceholder";

function App() {
  const query = useQuery({
    queryKey: ["classic", "today"],
    queryFn: () => fetchToday(),
    staleTime: Infinity,
  });
  const [attempts, setAttempts] = useState([] as (string | null)[]);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<Result>(Result.None);
  const [diff, setDiff] = useState<string>(
    DateTime.utc()
      .startOf("day")
      .plus({ days: 1 })
      .diffNow(["hours", "minutes", "seconds"])
      .toFormat("hh:mm:ss")
  );

  useEffect(() => {
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
  }, []);

  return (
    <div className="flex flex-col container mx-auto my-4 justify-center items-center gap-4 text-2xl lg:text-3xl xl:text-4xl">
      {query.isPending ? (
        <>
          <div className="h-[5.2ch]"></div>
          <p className="text-sm">
            {DateTime.utc().toFormat("yyyy-LL-dd")}&#x3000;
            <span className="blur-sm">何々級・Load</span>
          </p>
          <CoinPlaceholder />
          <span>読込中</span>
        </>
      ) : query.isError ? (
        <>
          <div className="h-[5.2ch]"></div>
          <p className="text-sm">
            {DateTime.utc().toFormat("yyyy-LL-dd")}&#x3000;
            <span className="blur-sm">何々級・Load</span>
          </p>
          <CoinPlaceholder />
          <span className="text-red-500">エラー</span>
          <span className="font-mono text-sm">{query.error.message}</span>
        </>
      ) : (
        <>
          <div className="flex flex-col h-[5.2ch] justify-center items-center gap-4">
            {result !== Result.None && (
              <>
                <p className="text-sm text-center mx-4">
                  次のパズルは
                  {diff}後
                </p>
                <button
                  className="bg-slate-200 dark:bg-slate-500 rounded-lg w-[14ch] h-[3ch] disabled:bg-slate-400 disabled:text-slate-600 text-center"
                  onClick={() => {
                    void window.navigator.clipboard.writeText(
                      `Kanjidle (Beta) ${DateTime.utc().toFormat(
                        "yyyy-LL-dd"
                      )} ${
                        result === Result.Lose ? "X" : attempts.length + 1
                      }/5\n` +
                        score(attempts.length, result) +
                        `\nhttps://kanjidle.onecomp.one`
                    );
                  }}
                >
                  {result === Result.Lose ? "X" : attempts.length + 1}
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
            className="flex flex-col lg:flex-row gap-4 justify-center items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (guess === query.data.answer) {
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
            <input
              name="answer"
              type="text"
              autoComplete="off"
              className="bg-slate-200 dark:bg-slate-500 rounded-xl w-[14ch] h-[3ch] disabled:bg-slate-400 dark:disabled:bg-slate-600 dark:disabled:text-slate-500 text-center"
              disabled={result !== Result.None}
              value={guess}
              placeholder="✏ 漢字１文字"
              onChange={(e) => setGuess(e.target.value)}
            ></input>
            <div className="flex flex-row gap-4 justify-center items-center flex-wrap">
              <button
                className="bg-slate-200 dark:bg-slate-500 rounded-xl w-[8ch] h-[3ch] disabled:bg-slate-400 disabled:text-slate-600 dark:disabled:bg-slate-600 dark:disabled:text-slate-500 text-center"
                type="submit"
                disabled={
                  !/^\p{Script=Han}$/u.test(guess) ||
                  attempts.includes(guess) ||
                  result !== Result.None
                }
              >
                決定
              </button>
              <button
                className="bg-slate-200 dark:bg-slate-500 rounded-xl w-[8ch] h-[3ch] disabled:bg-slate-400 disabled:text-slate-600 dark:disabled:bg-slate-600 dark:disabled:text-slate-500 text-center"
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
            </div>
          </form>
          <div className="flex flex-row justify-start items-center h-[3ch] gap-6">
            {attempts.map((x, i) => (
              <div
                key={String(x) + i}
                className="flex flex-row justify-center items-center text-red-600"
              >
                ✗
                {x ?? (
                  <div className="grid grid-rows-2 grid-cols-2 text-xs">
                    <div>ス</div>
                    <div>キ</div>
                    <div>ッ</div>
                    <div>プ</div>
                  </div>
                )}
              </div>
            ))}
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
    case 0:
      return "⬛🟩⬛\n🟩✅🟩\n⬛🟩⬛";
    case 1:
      return "🟩🟨⬛\n🟨✅🟨\n⬛🟨⬛";
    case 2:
      return "🟨🟨🟩\n🟨✅🟨\n⬛🟨⬛";
    case 3:
      return "🟨🟨🟨\n🟨✅🟨\n⬛🟨🟩";
    case 4:
    default:
      return "🟨🟨🟨\n🟨✅🟨\n🟩🟨🟨";
  }
}
