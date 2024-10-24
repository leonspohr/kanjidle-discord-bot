import {
  Button,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Input,
} from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import clsx from "clsx";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BiSolidDownArrow, BiSolidRightArrow } from "react-icons/bi";
import { DateTime, Duration } from "ts-luxon";

import Coin from "./components/Coin";
import CoinExample from "./components/CoinExample";
import CoinPlaceholder from "./components/CoinPlaceholder";
import CustomToast from "./components/CustomToast";
import CustomToaster from "./components/CustomToaster";
import { db, GameStateKey } from "./db/db";
import { Result } from "./db/Result";
import { Difficulty, fetchToday, Loc, Mode } from "./query/api";

function App() {
  const today = DateTime.utc().startOf("day");

  const query = useQuery({
    queryKey: ["hidden", "today"],
    queryFn: async () => {
      const res = await fetchToday();
      const key: GameStateKey = {
        mode: Mode.Hidden,
        difficulty: res.difficulty,
        date: +today,
      };
      if ((await db.game_states.get(key)) == null) {
        await db.game_states.put({
          ...key,
          attempts: [],
          result: Result.None,
        });
      }
      return res;
    },
    staleTime: Infinity,
  });

  const game = useMemo(() => {
    if (query.isSuccess) {
      const key: GameStateKey = {
        mode: Mode.Hidden,
        difficulty: query.data.difficulty,
        date: +today,
      };
      return key;
    }
    return null;
  }, [query.isSuccess, query.data?.difficulty, today]);

  const state = useLiveQuery(
    async () => (game ? await db.game_states.get(game) : null),
    [game],
  );

  const isFullyLoaded = query.isSuccess && game != null && state != null;

  const [diff, setDiff] = useState<Duration>(
    today.plus({ days: 1 }).diffNow(["hours", "minutes", "seconds"]),
  );

  useEffect(() => {
    if (isFullyLoaded && state.result !== Result.None) {
      const nextDay = today.plus({ days: 1 });
      const interval = setInterval(() => {
        const diff = nextDay.diffNow(["hours", "minutes", "seconds"]);
        setDiff(diff);
        if (diff.toMillis() <= 0) {
          window.location.reload();
        }
      }, 1_000);
      return () => clearInterval(interval);
    }
  }, [isFullyLoaded, state?.result, today]);

  useEffect(() => {
    if (isFullyLoaded) {
      if (state.result === Result.Lose) {
        loseConfetti();
      } else if (state.result === Result.Win) {
        winConfetti();
      }
    }
  }, [isFullyLoaded, state?.result]);

  const [guess, setGuess] = useState("");

  return (
    <div className="container mx-auto my-4 flex flex-col items-center justify-center gap-4 text-2xl lg:text-3xl xl:text-4xl">
      {import.meta.env.DEV && (
        <Button
          className="absolute left-0 top-0 text-base"
          onClick={() => {
            if (!isFullyLoaded) {
              return;
            }
            void db.game_states.where(game).modify((t) => {
              t.attempts = [];
              t.result = Result.None;
            });
          }}
        >
          RESET
        </Button>
      )}
      <h1>Kanjidle・漢字パズル</h1>
      <p className="text-sm">
        {today.toFormat("yyyy-LL-dd")}&#x3000;
        {isFullyLoaded ? (
          difficultyName(query.data.difficulty)
        ) : (
          <span className="blur-sm">何々級・Load</span>
        )}
      </p>
      <div
        className={clsx(
          "grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out",
          isFullyLoaded && state.result !== Result.None && "grid-rows-[1fr]",
        )}
      >
        {isFullyLoaded && state.result !== Result.None && (
          <div className="flex flex-col items-center justify-center gap-4 overflow-y-hidden">
            <Button
              className="h-[3ch] w-[14ch] rounded-lg border border-zinc-600 bg-inherit text-center text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 lg:text-2xl xl:text-3xl"
              onClick={() => {
                void window.navigator.clipboard.writeText(
                  `Kanjidle (Beta) ${today.toFormat("yyyy-LL-dd")} ${
                    state.result === Result.Lose ? "X" : state.attempts.length
                  }/5\n` +
                    score(state.attempts.length, state.result) +
                    `\nhttps://kanjidle.onecomp.one`,
                );
                toast(
                  <CustomToast type="success">コピーしました</CustomToast>,
                  {
                    id: "copy",
                  },
                );
              }}
            >
              コピーする
            </Button>
            <p className="mx-4 text-center text-sm">
              {diff.toMillis() <= 0 ? (
                <>ページをリフレッシュしてください</>
              ) : (
                <>
                  次のパズルは
                  {diff.toFormat("hh:mm:ss")}後
                </>
              )}
            </p>
          </div>
        )}
      </div>
      {isFullyLoaded ? (
        <Coin
          puzzle={query.data}
          showExtra={state.attempts.length}
          result={state.result}
        />
      ) : (
        <CoinPlaceholder />
      )}
      <form
        className="flex flex-row items-center justify-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isFullyLoaded) {
            return;
          }
          if (!/^\p{Script=Han}$/u.test(guess)) {
            toast(
              <CustomToast type="warn">
                漢字１文字を入力してください
              </CustomToast>,
              {
                id: "invalid-input",
              },
            );
          } else if (state.attempts.includes(guess)) {
            toast(
              <CustomToast type="warn">
                この漢字はすでに回答しました
              </CustomToast>,
              {
                id: "repeated-input",
              },
            );
          } else if (guess === query.data.answer) {
            void db.game_states.where(game).modify((t) => {
              t.attempts.push(guess);
              t.result = Result.Win;
            });
            setGuess("");
          } else if (guess !== query.data?.answer) {
            void db.game_states.where(game).modify((t) => {
              t.attempts.push(guess);
            });
            setGuess("");
            if (state.attempts.length === 4) {
              setGuess("");
              void db.game_states.where(game).modify((t) => {
                t.result = Result.Lose;
              });
            }
          }
        }}
      >
        <div className="flex flex-row items-center justify-center">
          <Input
            name="answer"
            type="text"
            autoComplete="off"
            className="z-10 h-[3ch] w-[10ch] rounded-md rounded-r-none border border-r-0 border-zinc-600 bg-inherit text-center outline outline-2 outline-transparent transition-colors duration-300 ease-in-out focus:outline-blue-400 disabled:border-stone-600 disabled:placeholder:opacity-0 lg:w-[14ch]"
            disabled={state != null && state.result !== Result.None}
            value={guess}
            placeholder="✏１文字"
            onChange={(e) => setGuess(e.target.value)}
          ></Input>
          <Button
            className="h-[3ch] w-[5ch] rounded-md rounded-l-none border border-emerald-600 bg-inherit text-center text-emerald-600 transition-colors duration-300 ease-in-out enabled:hover:bg-emerald-600 enabled:hover:text-zinc-200 enabled:active:bg-emerald-600 disabled:border-stone-600 disabled:text-stone-600"
            type="submit"
            disabled={state != null && state.result !== Result.None}
          >
            決定
          </Button>
        </div>
        <Button
          className="h-[3ch] w-[8ch] rounded-md border border-rose-600 bg-inherit text-center text-rose-600 transition-colors duration-300 ease-in-out enabled:hover:bg-rose-600 enabled:hover:text-zinc-200 enabled:active:bg-rose-600 disabled:border-stone-600 disabled:text-stone-600"
          type="button"
          disabled={isFullyLoaded && state.result !== Result.None}
          onClick={() => {
            if (!isFullyLoaded) {
              return;
            }
            void db.game_states.where(game).modify((t) => {
              t.attempts.push(null);
            });
            setGuess("");
            if (state.attempts.length === 4) {
              setGuess("");
              void db.game_states.where(game).modify((t) => {
                t.result = Result.Lose;
              });
            }
          }}
        >
          スキップ
        </Button>
      </form>
      <div className="flex h-[2ch] select-none flex-row items-center justify-start gap-6">
        {isFullyLoaded ? (
          state.attempts.length ? (
            state.attempts.map((x, i) => (
              <div
                key={String(x) + i}
                className={clsx(
                  "flex h-[2.5ch] w-[2.5ch] flex-row items-center justify-center rounded-md border",
                  x === query.data.answer
                    ? "border-green-600 text-green-600"
                    : "border-red-600 text-red-600",
                )}
              >
                {x ?? (
                  <div className="grid grid-cols-2 grid-rows-2 text-xs font-semibold leading-tight lg:text-sm xl:text-base">
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
          )
        ) : query.isLoading || state == null ? (
          <div className="text-sm text-stone-600">読込中…</div>
        ) : query.isError ? (
          <div className="font-mono text-sm text-rose-600">
            {query.error.message}
          </div>
        ) : (
          <div className="text-sm text-rose-600">予想外エラー</div>
        )}
      </div>
      <Disclosure
        as="div"
        className="flex flex-col items-center justify-center"
      >
        <DisclosureButton
          className={({ open }) =>
            clsx(
              "flex h-[3ch] w-[30ch] flex-row items-center justify-start rounded-lg border border-zinc-600 bg-inherit px-2 text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 lg:text-2xl xl:text-3xl",
              open && "border-b-1 rounded-b-none",
            )
          }
        >
          {({ open }) => (
            <>
              <span>{open ? <BiSolidDownArrow /> : <BiSolidRightArrow />}</span>
              <h2>パズルの解き方</h2>
            </>
          )}
        </DisclosureButton>
        <DisclosurePanel
          transition
          className="w-[30ch] origin-top rounded-lg rounded-t-none border border-t-0 border-zinc-600 text-xl transition duration-300 ease-out data-[closed]:-translate-y-6 data-[closed]:opacity-0 lg:text-2xl xl:text-3xl"
        >
          <div
            className={clsx(
              "mx-2 my-4 flex flex-col items-center justify-center gap-4 text-center text-base",
            )}
          >
            <CoinExample puzzle={example} showExtra={0} />
            <p>
              真ん中に漢字１文字を入れて全二字熟語を作りましょう！矢印は文字の順番を表します。
              <br />
              例えば、このパズルでは「◯地」「◯底」「内◯」「熱◯」の◯が求められます。
            </p>
            <CoinExample puzzle={example} showExtra={1} />
            <p>
              回答チャンスは５回だけです！間違えるかスキップすると新しいヒントが１個出ます！
              <br />
              ちなみに、正解は「心」です。
            </p>
          </div>
        </DisclosurePanel>
      </Disclosure>
      <CustomToaster />
    </div>
  );
}

export default App;

const example = {
  hints: [
    {
      answer: Loc.L,
      hint: "地",
    },
    {
      answer: Loc.L,
      hint: "底",
    },
    {
      answer: Loc.R,
      hint: "内",
    },
    {
      answer: Loc.R,
      hint: "熱",
    },
  ],
  extra_hints: [
    {
      answer: Loc.L,
      hint: "臓",
    },
    {
      answer: Loc.R,
      hint: "中",
    },
    {
      answer: Loc.R,
      hint: "安",
    },
    {
      answer: Loc.L,
      hint: "配",
    },
  ],
};

function difficultyName(d: Difficulty): string {
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
