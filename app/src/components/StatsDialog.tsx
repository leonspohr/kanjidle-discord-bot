import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import clsx from "clsx";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import toast from "react-hot-toast";
import { BiX } from "react-icons/bi";
import { DateTime } from "ts-luxon";

import { db, GameState } from "../db/db";
import { Result } from "../db/Result";
import { Mode } from "../query/api";
import toFixed from "../util/toFixed";
import CustomToast from "./CustomToast";

export interface StatsDialogProps {
  mode: Mode;
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsDialog({
  mode,
  isOpen,
  onClose,
}: StatsDialogProps) {
  const games = useLiveQuery(async () => {
    const st = await db.game_states
      .where({ mode })
      .and((st) => st.date !== 0 && st.result !== Result.None)
      .reverse()
      .sortBy("date");
    console.log(
      "Games fetched for stats",
      st.map((x) => ({
        ...x,
        s: new Date(x.date).toUTCString(),
      })),
    );
    return st;
  }, [mode]);

  const stats = useMemo(() => {
    if (!games) {
      return null;
    }

    let consecutiveFromNow = 0;
    let lost = false;
    let maxConsecutive = 0;
    let consecutive = 0;
    for (const game of games) {
      if (game.result === Result.Win) {
        if (!lost) {
          consecutiveFromNow += 1;
        }
        consecutive += 1;
      } else {
        lost = true;
        if (consecutive > maxConsecutive) {
          maxConsecutive = consecutive;
        }
        consecutive = 0;
      }
    }
    if (consecutive > maxConsecutive) {
      maxConsecutive = consecutive;
    }

    const guessCounts = Array.from({ length: 5 }, () => 0);
    let sumGuessCounts = 0;
    const hintCounts = Array.from({ length: 4 }, () => 0);
    let sumHintCounts = 0;
    let numberWon = 0;
    let numberLost = 0;
    for (const game of games) {
      if (game.result === Result.Win) {
        numberWon += 1;
        sumGuessCounts += game.attempts.length;
        if (mode === Mode.Classic) {
          sumHintCounts += game.hints;
          hintCounts[game.hints] += 1;
        }

        const k = (game.attempts.length >= 5 ? 5 : game.attempts.length) - 1;
        guessCounts[k] += 1;
      } else {
        numberLost += 1;
      }
    }
    const averageGuesses = sumGuessCounts / numberWon || 0;
    const averageHints = sumHintCounts / numberWon || 0;

    let changedStats = false;
    let addedGuessCount = null;
    let addedHintCount = null;
    let copyText = "";
    if (games.length && games[0].date === +DateTime.utc().startOf("day")) {
      changedStats = true;
      copyText = score(games[0]);
      if (games[0].result === Result.Win) {
        const k =
          (games[0].attempts.length >= 5 ? 5 : games[0].attempts.length) - 1;
        addedGuessCount = k;
        if (mode === Mode.Classic) {
          addedHintCount = games[0].hints;
        }
      }
    }

    return {
      changedStats,
      consecutiveFromNow,
      maxConsecutive,
      guessCounts,
      addedGuessCount,
      averageGuesses,
      hintCounts,
      addedHintCount,
      averageHints,
      numberWon,
      numberLost,
      copyText,
    };
  }, [games, mode]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/30 backdrop-blur-md duration-200 data-[closed]:backdrop-blur-none"
        onClick={() => onClose()}
      />
      <div className="fixed inset-0 w-screen overflow-y-auto p-4">
        <div className="z-20 flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="flex max-w-[500px] flex-col items-center justify-center gap-4 rounded-lg border border-zinc-600 bg-zinc-100 p-4 text-2xl text-zinc-900 shadow-lg transition-opacity duration-200 ease-out data-[closed]:opacity-0 lg:text-3xl xl:text-4xl dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-zinc-800"
          >
            <div className="flex w-full items-center justify-between">
              <DialogTitle className="flex flex-row items-end justify-start gap-2">
                <span>記録</span>
                <span className="text-base lg:text-lg xl:text-xl">
                  {mode === Mode.Hidden ? "隠しヒント" : "クラシック"}
                </span>
              </DialogTitle>
              <Button
                className="rounded-lg border border-zinc-600 p-1 hover:bg-zinc-600 hover:text-zinc-200 active:bg-zinc-600"
                onClick={() => onClose()}
              >
                <BiX />
              </Button>
            </div>
            <div className="flex w-full flex-col items-center justify-start gap-4 text-base lg:text-lg xl:text-xl">
              {games && stats && (
                <>
                  <div className="flex w-full flex-row items-center justify-start gap-4">
                    <span className="min-w-[4ch]">成績</span>
                    <div className="grow flex-col">
                      <span className="flex flex-row items-center gap-2">
                        <span>勝利</span>
                        <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                        <span
                          className={clsx(
                            stats.changedStats &&
                              stats.consecutiveFromNow >= 1 &&
                              "text-emerald-600",
                          )}
                        >
                          {stats.numberWon}勝
                        </span>
                      </span>
                      <span className="flex flex-row items-center gap-2">
                        <span>敗北</span>
                        <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                        <span
                          className={clsx(
                            stats.changedStats &&
                              stats.consecutiveFromNow === 0 &&
                              "text-rose-600",
                          )}
                        >
                          {stats.numberLost}敗
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full flex-row items-center justify-start gap-4">
                    <span className="min-w-[4ch]">連勝</span>
                    <div className="grow flex-col">
                      <span className="flex flex-row items-center gap-2">
                        <span>現在</span>
                        <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                        <span
                          className={clsx(
                            stats.changedStats &&
                              (stats.consecutiveFromNow >= 1
                                ? "text-emerald-600"
                                : "text-rose-600"),
                          )}
                        >
                          {stats.consecutiveFromNow}勝
                        </span>
                      </span>
                      <span className="flex flex-row items-center gap-2">
                        <span>最大</span>
                        <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                        <span
                          className={clsx(
                            stats.changedStats &&
                              stats.consecutiveFromNow >=
                                stats.maxConsecutive &&
                              "text-emerald-600",
                          )}
                        >
                          {stats.maxConsecutive}勝
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-100/25" />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex w-full flex-row items-center justify-between">
                      <span>回答数</span>
                      <span>平均{toFixed(stats.averageGuesses, 2)}回</span>
                    </div>
                    <div className="max-h-40 max-w-80">
                      <Bar
                        data={{
                          labels: [
                            "1回",
                            "2回",
                            "3回",
                            "4回",
                            mode === Mode.Hidden ? "5回" : "5回+",
                          ],
                          datasets: [
                            {
                              data: stats.guessCounts,
                              backgroundColor: Array.from(
                                stats.guessCounts,
                                (_, i) =>
                                  i === stats.addedGuessCount
                                    ? "rgb(5, 150, 105)"
                                    : "rgb(87, 83, 78)",
                              ),
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          transitions: {
                            show: { animations: { y: { from: 0 } } },
                            hide: { animations: { y: { from: 0 } } },
                          },
                          events: [],
                          scales: {
                            x: {
                              ticks: {
                                color: "rgb(87, 83, 78)",
                              },
                              grid: {
                                color: "rgb(87, 83, 78)",
                              },
                            },
                            y: {
                              ticks: {
                                precision: 0,
                                color: "rgb(87, 83, 78)",
                              },
                              grid: {
                                color: "rgb(87, 83, 78)",
                              },
                            },
                          },
                          plugins: {
                            tooltip: { enabled: false },
                            legend: { display: false },
                            datalabels: {
                              color: "rgb(244, 244, 245)",
                              font: { weight: "bold" },
                              anchor: "center",
                              align: "center",
                              formatter: (value) =>
                                value ? String(value) : "",
                            },
                          },
                        }}
                      />
                    </div>
                    {mode === Mode.Classic && (
                      <>
                        <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-100/25" />
                        <div className="flex w-full flex-row items-center justify-between">
                          <span>ヒント使用数</span>
                          <span>平均{toFixed(stats.averageHints, 2)}個</span>
                        </div>
                        <div className="max-h-40 max-w-80">
                          <Bar
                            data={{
                              labels: ["0個", "1個", "2個", "3個"],
                              datasets: [
                                {
                                  data: stats.hintCounts,
                                  backgroundColor: Array.from(
                                    stats.hintCounts,
                                    (_, i) =>
                                      i === stats.addedHintCount
                                        ? "rgb(5, 150, 105)"
                                        : "rgb(87, 83, 78)",
                                  ),
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              transitions: {
                                show: { animations: { y: { from: 0 } } },
                                hide: { animations: { y: { from: 0 } } },
                              },
                              events: [],
                              scales: {
                                x: {
                                  ticks: {
                                    color: "rgb(87, 83, 78)",
                                  },
                                  grid: {
                                    color: "rgb(87, 83, 78)",
                                  },
                                },
                                y: {
                                  ticks: {
                                    precision: 0,
                                    color: "rgb(87, 83, 78)",
                                  },
                                  grid: {
                                    color: "rgb(87, 83, 78)",
                                  },
                                },
                              },
                              plugins: {
                                tooltip: { enabled: false },
                                legend: { display: false },
                                datalabels: {
                                  color: "rgb(244, 244, 245)",
                                  font: { weight: "bold" },
                                  anchor: "center",
                                  align: "center",
                                  formatter: (value) =>
                                    value ? String(value) : "",
                                },
                              },
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {stats.copyText && (
                    <>
                      <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-100/25" />
                      <textarea
                        readOnly
                        rows={5}
                        wrap="soft"
                        className="w-full resize-none rounded-md border border-zinc-600 bg-inherit p-2 text-sm outline outline-2 outline-transparent transition-colors duration-300 ease-in-out focus:outline-blue-400"
                        value={stats.copyText}
                      />
                      <Button
                        className="h-[3ch] w-[14ch] rounded-lg border border-zinc-600 bg-inherit text-center text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 disabled:text-stone-600 lg:text-2xl xl:text-3xl"
                        onClick={() => {
                          void window.navigator.clipboard.writeText(
                            stats.copyText,
                          );
                          toast(
                            <CustomToast type="success">
                              コピーしました
                            </CustomToast>,
                            {
                              id: "copy",
                            },
                          );
                        }}
                      >
                        コピーする
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
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
      state.mode === Mode.Hidden
        ? " X/5"
        : ` ${state.attempts.length}回でギブ！`;
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
