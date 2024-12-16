import requests
from enum import Enum
from typing import List, Optional, Union


class Loc(Enum):
    L = "L"
    R = "R"


class Seed(Enum):
    Today = "today"
    Random = "random"


class Mode(Enum):
    Classic = "classic"
    Hidden = "hidden"


class Difficulty(Enum):
    Simple = "simple"
    Easy = "easy"
    Normal = "normal"
    Hard = "hard"
    Lunatic = "lunatic"
    Lunatic2 = "lunatic2"


class ResHint:
    def __init__(self, answer: Loc, hint: str):
        self.answer = answer
        self.hint = hint


class ResKanjiMeta:
    def __init__(
        self,
        level: str,
        class_name: str,
        stroke_count: int,
        radical: str,
        on: List[str],
        kun: List[Union[List[str], List[str, str]]],
    ):
        self.level = level
        self.class_name = class_name
        self.stroke_count = stroke_count
        self.radical = radical
        self.on = on
        self.kun = kun


class ResPuzzle:
    def __init__(
        self,
        hints: List[ResHint],
        extra_hints: List[ResHint],
        answer: str,
        answer_meta: ResKanjiMeta,
        difficulty: Difficulty,
    ):
        self.hints = hints
        self.extra_hints = extra_hints
        self.answer = answer
        self.answer_meta = answer_meta
        self.difficulty = difficulty


def fetch_puzzle(
    seed: Seed,
    mode: Mode,
    difficulty: Optional[Difficulty] = None,
) -> ResPuzzle:
    base_url = "https://your-api-url.com"
    url = f"{base_url}/v1/{seed.value}?mode={mode.value}"
    if difficulty:
        url += f"&difficulty={difficulty.value}"

    response = requests.get(url)
    response.raise_for_status()

    data = response.json()

    hints = [ResHint(Loc(item["answer"]), item["hint"]) for item in data["hints"]]
    extra_hints = [ResHint(Loc(item["answer"]), item["hint"]) for item in data["extra_hints"]]
    answer_meta_data = data["answer_meta"]
    answer_meta = ResKanjiMeta(
        level=answer_meta_data["level"],
        class_name=answer_meta_data["class"],
        stroke_count=answer_meta_data["stroke_count"],
        radical=answer_meta_data["radical"],
        on=answer_meta_data["on"],
        kun=answer_meta_data["kun"],
    )

    return ResPuzzle(
        hints=hints,
        extra_hints=extra_hints,
        answer=data["answer"],
        answer_meta=answer_meta,
        difficulty=Difficulty(data["difficulty"]),
    )