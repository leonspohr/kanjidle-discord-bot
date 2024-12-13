import clsx from "clsx";

export interface CoinPlaceholderProps {
  n: number;
}

export default function CoinPlaceholder({ n }: CoinPlaceholderProps) {
  const arr = Array.from({ length: n }, (_, i) => i);
  return (
    <div className="grid select-none grid-cols-coin grid-rows-coin place-items-center grid-areas-coin">
      {arr.map((i) => (
        <div
          key={i}
          className={clsx(
            [
              "grid-in-a1",
              "grid-in-a2",
              "grid-in-a3",
              "grid-in-a4",
              "translate-x-1.5 translate-y-1.5 grid-in-a5",
              "-translate-x-1.5 translate-y-1.5 grid-in-a6",
              "-translate-x-1.5 -translate-y-1.5 grid-in-a7",
              "-translate-y-1.5 translate-x-1.5 grid-in-a8",
            ][i],
            "text-4xl",
          )}
        >
          <span className="blur-sm">{"│─│─╲╱╲╱"[i]}</span>
        </div>
      ))}
      {arr.map((i) => (
        <div
          key={i}
          className={clsx(
            [
              "grid-in-w1",
              "grid-in-w2",
              "grid-in-w3",
              "grid-in-w4",
              "translate-x-1.5 translate-y-1.5 place-self-end grid-in-w5",
              "-translate-x-1.5 translate-y-1.5 self-end justify-self-start grid-in-w6",
              "-translate-x-1.5 -translate-y-1.5 place-self-start grid-in-w7",
              "-translate-y-1.5 translate-x-1.5 self-start justify-self-end grid-in-w8",
            ][i],
            "text-5xl",
          )}
        >
          <span className="blur">何</span>
          <span> </span>
        </div>
      ))}
      <div className={clsx("text-6xl grid-in-qq")}>
        <span>？</span>
        <span> </span>
      </div>
    </div>
  );
}
