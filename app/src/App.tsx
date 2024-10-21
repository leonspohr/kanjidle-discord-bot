import { useQuery } from "@tanstack/react-query";
import { fetchToday } from "./query/api";
import { useState } from "react";
import Coin from "./components/Coin";
import { Result } from "./Result";

function App() {
  const query = useQuery({
    queryKey: ["classic", "today"],
    queryFn: () => fetchToday(),
  });
  const [attempts, setAttempts] = useState([] as (string | null)[]);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<Result>(Result.None);

  return (
    <div className="flex flex-col container mx-auto my-4 justify-center items-center gap-4 text-2xl lg:text-3xl xl:text-4xl">
      {query.isPending ? (
        <span>読込中</span>
      ) : query.isError ? (
        <span>エラー</span>
      ) : (
        <>
          <div className="flex flex-col justify-center items-center gap-4 h-[4ch]">
            {result !== Result.None && (
              <button
                className="bg-slate-200 dark:bg-slate-500 rounded-lg w-[14ch] h-[3ch] disabled:bg-slate-400 disabled:text-slate-600 text-center"
                onClick={() => {
                  void window.navigator.clipboard.writeText(
                    `Kanjidle (Beta) ${new Date().toJSON().slice(0, 10)} ${
                      result === Result.Lose ? "X" : attempts.length + 1
                    }/5\n` +
                      score(attempts.length, result) +
                      `\nhttps://kanjidle.onecomp.one`
                  );
                }}
              >
                スコアをコピー
              </button>
            )}
          </div>
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
          <div className="flex flex-col justify-start items-center h-[8em] gap-2">
            {attempts.map((x, i) => (
              <span key={String(x) + i} className="text-red-600">
                ✘ {x ?? "　"}
              </span>
            ))}
          </div>
          <p className="text-base text-center mx-4">
            漢字とそれぞれ矢印通りにニ字熟語を成立する漢字は何？
            <br />
            回答チャンスは５回！誤答すると新しいヒントが出る！
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
