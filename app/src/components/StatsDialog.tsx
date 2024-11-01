import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Radio,
  RadioGroup,
} from "@headlessui/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import toast from "react-hot-toast";
import { BiX } from "react-icons/bi";

import { db } from "../db/db";
import { Result } from "../db/Result";
import { Mode } from "../query/api";
import toFixed from "../util/toFixed";
import CustomToast from "./CustomToast";

export interface StatsDialogProps {
  copyText: string | null;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsDialog({
  copyText,
  mode,
  onModeChange,
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

    let guessCounts;
    let sumGuessCounts = 0;
    let sumHintCounts = 0;
    let numberWon = 0;
    if (mode === Mode.Hidden) {
      guessCounts = Array.from({ length: 6 }, () => 0);
    } else {
      guessCounts = Array.from({ length: 6 }, () => 0);
    }
    for (const game of games) {
      if (game.result === Result.Win) {
        if (mode === Mode.Classic) {
          sumHintCounts += game.hints;
        }
        sumGuessCounts += game.attempts.length;
        numberWon += 1;

        const k = game.attempts.length >= 5 ? 5 : game.attempts.length;
        guessCounts[k - 1] += 1;
      } else {
        guessCounts[guessCounts.length - 1] += 1;
      }
    }
    const averageGuesses = sumGuessCounts / numberWon || 0;
    const averageHints = sumHintCounts / numberWon || 0;

    return {
      consecutiveFromNow,
      maxConsecutive,
      guessCounts,
      averageGuesses,
      averageHints,
    };
  }, [games, mode]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-20">
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 backdrop-blur-md duration-200 data-[closed]:backdrop-blur-none"
          onClick={() => onClose()}
        />
        <DialogPanel
          transition
          className="z-10 flex max-w-[500px] flex-col items-center justify-center gap-4 rounded-lg border border-zinc-600 bg-zinc-100 p-4 text-2xl text-zinc-900 shadow-lg transition-opacity duration-200 ease-out data-[closed]:opacity-0 lg:text-3xl xl:text-4xl dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-zinc-800"
        >
          <div className="flex w-full items-center justify-between">
            <DialogTitle className="flex flex-row items-end justify-start gap-2">
              <span>記録</span>
              <span className="text-base lg:text-lg xl:text-xl">
                {copyText
                  ? mode === Mode.Hidden
                    ? "隠しヒント"
                    : "クラシック"
                  : ""}
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
            {!copyText && (
              <RadioGroup
                value={mode}
                onChange={onModeChange}
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
            )}
            {games && stats && (
              <>
                <div className="flex w-full flex-row items-center justify-start gap-4">
                  <span className="min-w-[4ch]">連勝</span>
                  <div className="grow flex-col">
                    <span className="flex flex-row items-center gap-2">
                      <span>現在</span>
                      <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                      <span className="text-emerald-600">
                        {stats.consecutiveFromNow}勝
                      </span>
                    </span>
                    <span className="flex flex-row items-center gap-2">
                      <span>最大記録</span>
                      <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                      <span className="text-emerald-600">
                        {stats.maxConsecutive}勝
                      </span>
                    </span>
                  </div>
                </div>
                <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-100/25" />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="grid grid-cols-[1fr,auto] grid-rows-[auto,1fr,auto] place-items-center grid-areas-[title_title,y_chart,._x]">
                    <span className="grid-in-[title]">回答数の回数</span>
                    <div className="max-h-40 max-w-80 grid-in-[chart]">
                      <Bar
                        data={{
                          labels: [
                            "1",
                            "2",
                            "3",
                            "4",
                            mode === Mode.Hidden ? "5" : "5+",
                            "X",
                          ],
                          datasets: [
                            {
                              data: stats.guessCounts,
                              backgroundColor: Array.from(
                                stats.guessCounts,
                                (_, i) =>
                                  i === stats.guessCounts.length - 1
                                    ? "rgb(225, 29, 72)"
                                    : "rgb(5, 150, 105)",
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
                    <span className="text-xs text-stone-600 grid-in-[x] lg:text-sm xl:text-base">
                      回答数
                    </span>
                  </div>
                  <div className="flex w-full flex-row items-center justify-start gap-4">
                    <span>平均回答数</span>
                    <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                    <span>{toFixed(stats.averageGuesses, 2)}回</span>
                  </div>
                  {mode === Mode.Classic && (
                    <div className="flex w-full flex-row items-center justify-start gap-4">
                      <span>平均ヒント</span>
                      <div className="my-0.5 h-px grow bg-zinc-900/25 dark:bg-zinc-100/25" />
                      <span>{toFixed(stats.averageHints, 2)}個</span>
                    </div>
                  )}
                </div>
              </>
            )}
            {copyText && (
              <>
                <div className="my-0.5 h-px w-full bg-zinc-900/25 dark:bg-zinc-100/25" />
                <textarea
                  readOnly
                  rows={5}
                  wrap="soft"
                  className="w-full resize-none rounded-md border border-zinc-600 bg-inherit p-2 text-sm outline outline-2 outline-transparent transition-colors duration-300 ease-in-out focus:outline-blue-400"
                  value={copyText}
                />
                <Button
                  className="h-[3ch] w-[14ch] rounded-lg border border-zinc-600 bg-inherit text-center text-xl enabled:hover:bg-zinc-600 enabled:hover:text-zinc-200 enabled:active:bg-zinc-600 disabled:border-stone-600 disabled:text-stone-600 lg:text-2xl xl:text-3xl"
                  onClick={() => {
                    void window.navigator.clipboard.writeText(copyText);
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
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
