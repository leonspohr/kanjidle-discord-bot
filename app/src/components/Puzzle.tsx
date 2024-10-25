import {
  Button,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Radio,
  RadioGroup,
} from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import clsx from "clsx";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  BiSolidDownArrow,
  BiSolidLockAlt,
  BiSolidRightArrow,
} from "react-icons/bi";
import { DateTime, Duration } from "ts-luxon";

import { db, GameState, GameStateKey } from "../db/db";
import { Result } from "../db/Result";
import useLocalStorage, { useJSONLocalStorage } from "../hooks/useLocalStorage";
import { Difficulty, fetchPuzzle, Loc, Mode, Seed } from "../query/api";
import Coin from "./Coin";
import CoinExample from "./CoinExample";
import CoinPlaceholder from "./CoinPlaceholder";
import CustomToast from "./CustomToast";
import CustomToaster from "./CustomToaster";

export default function Puzzle() {
  const [mode, setMode] = useLocalStorage<Mode>("mode", Mode.Hidden);

  const [seed, setSeed] = useState<Seed>(Seed.Today);

  const [difficulty, setDifficulty] = useJSONLocalStorage<Difficulty>(
    "difficulty",
    Difficulty.Normal,
  );

  const today = DateTime.utc().startOf("day");
  const date = useMemo(() => (seed === Seed.Today ? +today : 0), [seed, today]);

  const query = useQuery({
    queryKey: [mode, seed, difficulty, date] as const,
    queryFn: async ({ queryKey: [mode, seed, difficulty, date] }) => {
      if (seed === Seed.Today) {
        const res = await fetchPuzzle(Seed.Today, mode);
        const key: GameStateKey = {
          mode,
          difficulty: res.difficulty,
          date,
        };
        console.log("Checking if game state exists", key);
        const st = await db.game_states.get(key);
        console.log("Found game state if exists", st);
        if (st == null) {
          console.log("Putting game state", key);
          await db.game_states.put({
            ...key,
            attempts: [],
            result: Result.None,
            puzzle: null,
            hints: 0,
          });
        }
        return res;
      }

      const key: GameStateKey = {
        mode,
        difficulty,
        date,
      };
      console.log("Checking if game state exists", key);
      const st = await db.game_states.get(key);
      console.log("Found game state if exists", st);
      if (st?.puzzle == null) {
        const res = await fetchPuzzle(Seed.Random, mode, difficulty);
        console.log("Putting game state", key);
        await db.game_states.put({
          ...key,
          attempts: [],
          result: Result.None,
          puzzle: res,
          hints: 0,
        });
        return res;
      }
      return st.puzzle;
    },
    staleTime: Infinity,
  });

  const game = useMemo(() => {
    if (query.isSuccess) {
      const key: GameStateKey = {
        mode,
        difficulty: query.data.difficulty,
        date,
      };
      return key;
    }
    return null;
  }, [query.isSuccess, query.data?.difficulty, mode, date]);

  const state = useLiveQuery(async () => {
    if (game) {
      console.log("Getting game state for use", game);
      const st = await db.game_states.get(game);
      console.log("Found game state for use", st);
      return st;
    }
    return null;
  }, [game]);

  const isFullyLoaded = query.isSuccess && game != null && state != null;

  const [diff, setDiff] = useState<Duration>(
    today.plus({ days: 1 }).diffNow(["hours", "minutes", "seconds"]),
  );

  useEffect(() => {
    if (isFullyLoaded && seed === Seed.Today && state.result !== Result.None) {
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
  }, [isFullyLoaded, seed, state?.result, today]);

  const [guess, setGuess] = useState("");

  return (
    <div className="container mx-auto my-2 flex flex-col items-center justify-center gap-4">
      {import.meta.env.DEV && (
        <Button
          className="absolute left-0 top-0 text-base"
          onClick={() => {
            if (!isFullyLoaded) {
              return;
            }
            void db.game_states.where(game).modify((t) => {
              t.attempts = [];
              t.hints = 0;
              t.result = Result.None;
            });
          }}
        >
          RESET
        </Button>
      )}
      <div className="flex flex-row flex-wrap items-center justify-center gap-2 text-base lg:text-lg xl:text-xl">
        <RadioGroup
          value={mode}
          onChange={setMode}
          className="flex flex-col items-center justify-center gap-2"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex w-full flex-row items-center justify-center">
              <Radio
                as="button"
                value={Mode.Hidden}
                className="h-[3ch] w-[12ch] rounded-md rounded-r-none border border-zinc-600 bg-inherit text-center text-base hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600 data-[checked]:bg-zinc-600 data-[checked]:text-zinc-200 lg:text-lg xl:text-xl"
              >
                隠しヒント
              </Radio>
              <Radio
                as="button"
                value={Mode.Classic}
                className="h-[3ch] w-[12ch] rounded-md rounded-l-none border border-zinc-600 bg-inherit text-center text-base hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600 data-[checked]:bg-zinc-600 data-[checked]:text-zinc-200 lg:text-lg xl:text-xl"
              >
                クラシック
              </Radio>
            </div>
          </div>
        </RadioGroup>
        <div className="flex flex-row flex-wrap items-center justify-center gap-2">
          <Menu>
            <MenuButton className="flex h-[3ch] flex-row items-center justify-center gap-1 rounded-lg border border-zinc-600 bg-inherit px-2 text-center enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600">
              {({ active }) => (
                <>
                  <span>
                    {active ? <BiSolidDownArrow /> : <BiSolidRightArrow />}
                  </span>
                  <span>
                    {seed === Seed.Today
                      ? today.toFormat("yyyy年LL月dd日")
                      : "ランダム"}
                  </span>
                </>
              )}
            </MenuButton>
            <MenuItems
              anchor="bottom"
              className="my-1 flex flex-col items-center justify-center rounded-lg border border-zinc-600 bg-zinc-200 p-1 text-base text-zinc-900 lg:text-lg xl:text-xl dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-zinc-800"
            >
              <MenuItem>
                <Button
                  className="flex w-full flex-row items-center justify-center rounded-md px-1 text-center enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600"
                  onClick={() => {
                    setSeed(Seed.Today);
                  }}
                >
                  {today.toFormat("yyyy年LL月dd日")}
                </Button>
              </MenuItem>
              <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-200/25" />
              <MenuItem>
                <Button
                  className="flex w-full flex-row items-center justify-center rounded-md px-1 text-center enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600"
                  onClick={() => {
                    setSeed(Seed.Random);
                    if (!difficulty) {
                      setDifficulty(Difficulty.Normal);
                    }
                  }}
                >
                  ランダム
                </Button>
              </MenuItem>
            </MenuItems>
          </Menu>
          {seed === Seed.Today ? (
            isFullyLoaded ? (
              <div className="flex h-[3ch] select-none flex-row items-center justify-center gap-1 rounded-lg border border-zinc-600 bg-inherit px-2 text-center enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600">
                <span>
                  <BiSolidLockAlt />
                </span>
                <span>{difficultyName(query.data.difficulty)}</span>
              </div>
            ) : (
              <span className="blur-sm">何々級・Load</span>
            )
          ) : (
            <Menu>
              <MenuButton className="flex h-[3ch] flex-row items-center justify-center gap-1 rounded-lg border border-zinc-600 bg-inherit px-2 text-center enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600">
                {({ active }) => (
                  <>
                    <span>
                      {active ? <BiSolidDownArrow /> : <BiSolidRightArrow />}
                    </span>
                    <span>{difficultyName(difficulty)}</span>
                  </>
                )}
              </MenuButton>
              <MenuItems
                anchor="bottom"
                className="my-1 flex flex-col items-center justify-center rounded-lg border border-zinc-600 bg-zinc-200 p-1 text-base text-zinc-900 lg:text-lg xl:text-xl dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-zinc-800"
              >
                {Object.values(Difficulty).map((d, i) => (
                  <>
                    <MenuItem key={d}>
                      <Button
                        className="flex w-full flex-row items-center justify-center rounded-md px-1 text-center enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600"
                        onClick={() => {
                          setDifficulty(d);
                        }}
                      >
                        {difficultyName(d)}
                      </Button>
                    </MenuItem>
                    {i !== Object.values(Difficulty).length - 1 && (
                      <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-200/25" />
                    )}
                  </>
                ))}
              </MenuItems>
            </Menu>
          )}
        </div>
      </div>
      <div
        className={clsx(
          "-mt-4 grid transition-[grid-template-rows] duration-300 ease-out",
          isFullyLoaded && state.result !== Result.None
            ? "mt-0 grid-rows-[1fr]"
            : "grid-rows-[0fr]",
        )}
      >
        {isFullyLoaded && state.result !== Result.None && (
          <div className="flex flex-col items-center justify-center gap-4 overflow-y-hidden">
            {seed === Seed.Today ? (
              <>
                <Button
                  className="h-[3ch] w-[14ch] rounded-lg border border-zinc-600 bg-inherit text-center text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 disabled:text-stone-600 lg:text-2xl xl:text-3xl"
                  onClick={() => {
                    void window.navigator.clipboard.writeText(score(state));
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
              </>
            ) : (
              <>
                <Button
                  className="h-[3ch] w-[14ch] rounded-lg border border-zinc-600 bg-inherit text-center text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 lg:text-2xl xl:text-3xl"
                  onClick={() => {
                    void db.game_states
                      .where(game)
                      .delete()
                      .then(() => query.refetch());
                  }}
                >
                  ニューゲーム
                </Button>
                <p className="mx-4 text-center text-sm">
                  新しいパズルをやってみましょう！
                </p>
              </>
            )}
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
        <CoinPlaceholder n={mode === Mode.Hidden ? 8 : 4} />
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
            void winConfetti();
          } else if (guess !== query.data?.answer) {
            void db.game_states.where(game).modify((t) => {
              t.attempts.push(guess);
            });
            setGuess("");
            if (mode === Mode.Hidden && state.attempts.length === 4) {
              setGuess("");
              void db.game_states.where(game).modify((t) => {
                t.result = Result.Lose;
              });
              void loseConfetti();
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
            if (mode === Mode.Classic) {
              void db.game_states.where(game).modify((t) => {
                t.result = Result.Lose;
              });
              void loseConfetti();
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
              void loseConfetti();
            }
          }}
        >
          {mode === Mode.Hidden ? "スキップ" : "ギブ"}
        </Button>
      </form>

      <div className="flex min-h-[2.6ch] max-w-[17.8ch] select-none flex-row flex-wrap items-center justify-start gap-4 lg:gap-5 xl:gap-6">
        {isFullyLoaded ? (
          state.attempts.length ? (
            state.attempts.map((x, i) => (
              <div
                key={String(x) + i}
                className={clsx(
                  "flex h-[2.6ch] w-[2.6ch] flex-row items-center justify-center rounded-md border pb-1",
                  x === query.data.answer
                    ? "border-green-600 text-green-600"
                    : "border-red-600 text-red-600",
                )}
              >
                {x ?? (
                  <div className="grid grid-cols-2 grid-rows-2 text-xs font-semibold lg:text-sm xl:text-base">
                    <div className="translate-y-0.5">ス</div>
                    <div className="translate-y-0.5">キ</div>
                    <div>ッ</div>
                    <div>プ</div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-base text-stone-600 lg:text-lg xl:text-xl">
              {mode === Mode.Hidden
                ? "回答とスキップはここに記録します"
                : "回答はここに記録します"}
            </div>
          )
        ) : query.isLoading || state == null ? (
          <div className="text-base text-stone-600 lg:text-lg xl:text-xl">
            読込中…
          </div>
        ) : query.isError ? (
          <div className="font-mono text-base text-rose-600">
            {query.error.message}
          </div>
        ) : (
          <div className="text-base text-rose-600 lg:text-lg xl:text-xl">
            予想外エラー
          </div>
        )}
      </div>
      {mode === Mode.Classic && (
        <div className="flex flex-col items-center justify-center gap-2">
          <Button
            disabled={
              !isFullyLoaded || state.hints >= 1 || state.result !== Result.None
            }
            className={clsx(
              "h-[3ch] w-[30ch] rounded-lg border border-emerald-600 bg-inherit text-center text-xl text-emerald-600 transition-colors duration-300 ease-in-out enabled:hover:bg-emerald-600 enabled:hover:text-zinc-200 enabled:active:bg-emerald-600 lg:text-2xl xl:text-3xl",
              isFullyLoaded && state.hints >= 1
                ? "disabled:border-amber-600 disabled:text-amber-600"
                : "disabled:border-stone-600 disabled:text-stone-600",
            )}
            onClick={() => {
              if (!isFullyLoaded) {
                return;
              }
              void db.game_states.where(game).modify((t) => {
                t.hints++;
              });
            }}
          >
            {isFullyLoaded && state.hints >= 1
              ? query.data.answer_meta.level
              : "漢検レベル"}
          </Button>
          <Button
            disabled={
              !isFullyLoaded ||
              state.hints < 1 ||
              state.hints >= 2 ||
              state.result !== Result.None
            }
            className={clsx(
              "h-[3ch] w-[30ch] rounded-lg border border-emerald-600 bg-inherit text-center text-xl text-emerald-600 transition-colors duration-300 ease-in-out enabled:hover:bg-emerald-600 enabled:hover:text-zinc-200 enabled:active:bg-emerald-600 lg:text-2xl xl:text-3xl",
              isFullyLoaded && state.hints >= 2
                ? "disabled:border-amber-600 disabled:text-amber-600"
                : "disabled:border-stone-600 disabled:text-stone-600",
            )}
            onClick={() => {
              if (!isFullyLoaded) {
                return;
              }
              void db.game_states.where(game).modify((t) => {
                t.hints++;
              });
            }}
          >
            {isFullyLoaded && state.hints >= 2
              ? query.data.answer_meta.stroke_count + "画"
              : "画数"}
          </Button>
          <Button
            disabled={
              !isFullyLoaded ||
              state.hints < 2 ||
              state.hints >= 3 ||
              state.result !== Result.None
            }
            className={clsx(
              "h-[3ch] w-[30ch] rounded-lg border border-emerald-600 bg-inherit text-center text-xl text-emerald-600 transition-colors duration-300 ease-in-out enabled:hover:bg-emerald-600 enabled:hover:text-zinc-200 enabled:active:bg-emerald-600 lg:text-2xl xl:text-3xl",
              isFullyLoaded && state.hints >= 3
                ? "disabled:border-amber-600 disabled:text-amber-600"
                : "disabled:border-stone-600 disabled:text-stone-600",
            )}
            onClick={() => {
              if (!isFullyLoaded) {
                return;
              }
              void db.game_states.where(game).modify((t) => {
                t.hints++;
              });
            }}
          >
            {isFullyLoaded && state.hints >= 3
              ? query.data.answer_meta.radical
                  .split("・")
                  .some((r) => query.data.answer === r)
                ? "部首は漢字と同じ"
                : query.data.answer_meta.radical
              : "部首"}
          </Button>
        </div>
      )}
      <Disclosure
        as="div"
        className="flex flex-col items-center justify-center"
      >
        <DisclosureButton
          className={({ open }) =>
            clsx(
              "flex h-[3ch] w-[30ch] flex-row items-center justify-start gap-1 rounded-lg border border-zinc-600 bg-inherit px-2 text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 disabled:text-stone-600 lg:text-2xl xl:text-3xl",
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
            {mode === Mode.Hidden ? (
              <>
                <CoinExample puzzle={exampleHidden} showExtra={0} />
                <p>
                  真ん中に漢字１文字を入れてすべての二字熟語を作りましょう！矢印は文字の順番を表します。例えば、このパズルでは「◯地」「◯底」「内◯」「熱◯」の◯が求められます。
                </p>
                <CoinExample puzzle={exampleHidden} showExtra={1} />
                <p>
                  回答チャンスは５回だけです！間違えるかスキップすると新しいヒントが１個出ます！ちなみに、正解は「心」です。
                </p>
              </>
            ) : (
              <>
                <CoinExample puzzle={exampleClassic} showExtra={0} />
                <p>
                  真ん中に漢字１文字を入れてすべての二字熟語を作りましょう！矢印は文字の順番を表します。例えば、このパズルでは「◯折」「◯計」「当◯」「◯代」の◯が求められます。
                </p>
                <div className="flex select-none flex-row items-center justify-center gap-2">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="h-[3ch] w-[12ch] rounded-lg border border-emerald-600 bg-inherit text-center text-base text-emerald-600">
                      部首
                    </div>
                    <div className="h-[3ch] w-[12ch] rounded-lg border border-stone-600 bg-inherit text-center text-base text-stone-600">
                      画数
                    </div>
                  </div>
                  <span>→</span>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="h-[3ch] w-[12ch] rounded-lg border border-amber-600 bg-inherit text-center text-base text-amber-600">
                      日
                    </div>
                    <div className="h-[3ch] w-[12ch] rounded-lg border border-emerald-600 bg-inherit text-center text-base text-emerald-600">
                      画数
                    </div>
                  </div>
                </div>
                <p>
                  回答チャンスは無限です！ヒントは正解の漢字のことに関し、そしていつでも順番に使えます。ちなみに、正解は「時」です。
                </p>
              </>
            )}
          </div>
        </DisclosurePanel>
      </Disclosure>
      <CustomToaster />
    </div>
  );
}

const exampleHidden = {
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

const exampleClassic = {
  hints: [
    { answer: Loc.L, hint: "折" },
    { answer: Loc.L, hint: "計" },
    { answer: Loc.R, hint: "当" },
    { answer: Loc.L, hint: "代" },
  ],
  extra_hints: [],
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
    case Difficulty.Lunatic2:
      return "奇譚級・Lunatic+";
  }
}

function score(state: GameState): string {
  const today = DateTime.fromMillis(state.date, { zone: "utc" }).toFormat(
    "yyyy年LL月dd日",
  );
  const mode = state.mode === Mode.Hidden ? "隠しヒント" : "クラシック";
  let lines;
  if (state.result === Result.Lose && state.mode === Mode.Classic) {
    lines = ["⬛🟨⬛", "🟨🟥🟨", "⬛🟨⬛"];
  } else if (state.result === Result.Lose && state.mode === Mode.Hidden) {
    lines = ["🟨🟨🟨", "🟨🟥🟨", "🟨🟨🟨"];
  } else if (state.mode === Mode.Classic) {
    lines = ["⬛🟩⬛", "🟩✅🟩", "⬛🟩⬛"];
  } else {
    switch (state.attempts.length) {
      case 1:
        lines = ["⬛🟩⬛", "🟩✅🟩", "⬛🟩⬛"];
        break;
      case 2:
        lines = ["🟩🟨⬛", "🟨✅🟨", "⬛🟨⬛"];
        break;
      case 3:
        lines = ["🟨🟨🟩", "🟨✅🟨", "⬛🟨⬛"];
        break;
      case 4:
        lines = ["🟨🟨🟨", "🟨✅🟨", "⬛🟨🟩"];
        break;
      case 5:
      default:
        lines = ["🟨🟨🟨", "🟨✅🟨", "🟩🟨🟨"];
        break;
    }
  }
  lines.unshift(`Kanjidle ${today}`);
  lines.push("https://kanjidle.onecomp.one");
  lines[1] += " " + mode;
  if (state.result === Result.Lose) {
    lines[2] +=
      state.mode === Mode.Hidden ? " X/5" : ` ${state.attempts.length}でギブ！`;
  } else {
    lines[2] +=
      state.mode === Mode.Hidden
        ? ` ${state.attempts.length}/5`
        : ` ${state.attempts.length}回目`;
  }
  if (state.mode === Mode.Classic) {
    lines[3] += state.hints ? ` ヒント${state.hints}個` : ` ヒントなし！`;
  }
  return lines.join("\n");
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
