import Dexie, { EntityTable } from "dexie";

import { Difficulty, Mode, ResPuzzle } from "../query/api";
import { Result } from "./Result";

export interface GameState {
  mode: Mode;
  difficulty: Difficulty;
  date: number; // Seed is random means date is 0
  attempts: (string | null)[];
  result: Result;
  puzzle: ResPuzzle | null; // Only set if seed is random
  hints: number; // Only increment if mode is classic
}

export type GameStateKey = Pick<GameState, "mode" | "difficulty" | "date">;

export const db = new Dexie("kanjidle") as Dexie & {
  game_states: EntityTable<GameState>;
};

db.version(1).stores({
  game_states: "[mode+difficulty+date], attempts, result",
});

db.version(2)
  .stores({
    game_states: "[mode+difficulty+date], attempts, result, puzzle, hints",
  })
  .upgrade((tx) =>
    tx
      .table("game_states")
      .toCollection()
      .modify((old: GameState) => {
        old.puzzle = null;
        old.hints = 0;
      }),
  );
