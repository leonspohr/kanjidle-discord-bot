import { useQuery } from "@tanstack/react-query";
import { fetchToday, pretty } from "./query/api";
import { useState } from "react";

function App() {
  const query = useQuery({
    queryKey: ["classic", "today"],
    queryFn: () => fetchToday(),
  });
  const [attempts, setAttempts] = useState([] as string[]);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(0);

  return (
    <div className="flex flex-col w-screen h-screen items-center justify-center gap-4">
      {query.isPending ? (
        <span className="text-4xl">読込中</span>
      ) : query.isError ? (
        <span className="text-4xl">エラー</span>
      ) : (
        <>
          <div className="flex flex-col items-center justify-center gap-4 h-40">
            {result === 1 ? (
              <>
                <span className="text-8xl text-green-500">
                  {query.data.answer}
                </span>
                <button
                  className="border border-black bg-slate-200 p-2 rounded-lg"
                  onClick={() => {
                    void window.navigator.clipboard.writeText(
                      `Kanjidle (Beta) ${new Date().toJSON().slice(0, 10)} ${
                        attempts.length + 1
                      }/5\n` + `https://kanjidle.onecomp.one`
                    );
                  }}
                >
                  Share Result
                </button>
              </>
            ) : (
              result === 2 && (
                <>
                  <span className="text-8xl text-red-500">
                    {query.data.answer}
                  </span>
                  <button
                    className="border border-black bg-slate-200 p-2 rounded-lg"
                    onClick={() => {
                      void window.navigator.clipboard.writeText(
                        `Kanjidle (Beta) ${new Date()
                          .toJSON()
                          .slice(0, 10)} X/5\n` + `https://kanjidle.onecomp.one`
                      );
                    }}
                  >
                    Share Result
                  </button>
                </>
              )
            )}
          </div>
          <div className="flex flex-col items-center justify-center gap-4 h-28">
            <span className="text-4xl">
              {pretty(
                query.data.hints,
                result > 0 ? query.data.answer : undefined
              )}
            </span>
            {attempts.length > 0 && (
              <span className="text-4xl">
                {pretty(
                  query.data.extra_hints.slice(0, attempts.length),
                  result > 0 ? query.data.answer : undefined
                )}
              </span>
            )}
          </div>
          <form
            className="flex flex-row gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (guess === query.data.answer) {
                setResult(1);
              } else if (guess !== query.data?.answer) {
                setAttempts([...attempts, guess]);
                setGuess("");
                if (attempts.length === 4) {
                  setResult(2);
                }
              }
            }}
          >
            <input
              className="border border-black bg-slate-200 px-4 py-2 rounded-xl w-80 disabled:bg-slate-400 text-center text-4xl"
              disabled={result > 0}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
            ></input>
            <button
              className="border border-black bg-slate-200 px-4 py-2 rounded-xl disabled:bg-slate-400 text-4xl"
              type="submit"
              disabled={
                !/^\p{Script=Han}$/u.test(guess) ||
                attempts.includes(guess) ||
                result > 0
              }
            >
              ゲス！
            </button>
            <button
              className="border border-black bg-slate-200 px-4 py-2 rounded-xl disabled:bg-slate-400 text-4xl"
              type="button"
              disabled={result > 0}
              onClick={() => {
                setAttempts([...attempts, "スキップ"]);
                setGuess("");
                if (attempts.length === 4) {
                  setResult(2);
                }
              }}
            >
              スキップ
            </button>
          </form>
          <div className="flex flex-col items-center justify-center h-44">
            {attempts.map((x) => (
              <span key={x} className="text-red-600 text-2xl">
                {x}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
