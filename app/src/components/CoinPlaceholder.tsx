import clsx from "clsx";

export default function CoinPlaceholder() {
  return (
    <div className="grid select-none grid-cols-coin grid-rows-coin place-items-center grid-areas-coin">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
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
            "text-2xl",
          )}
        >
          <span className="blur-sm">{"│─│─╲╱╲╱"[i]}</span>
        </div>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className={clsx(
            [
              "grid-in-w1",
              "grid-in-w2",
              "grid-in-w3",
              "grid-in-w4",
              "place-self-end grid-in-w5",
              "self-end justify-self-start grid-in-w6",
              "place-self-start grid-in-w7",
              "self-start justify-self-end grid-in-w8",
            ][i],
            "text-4xl",
          )}
        >
          <span className="blur">何</span>
          <span> </span>
        </div>
      ))}
      <div className={clsx("text-5xl grid-in-qq")}>
        <span>？</span>
        <span> </span>
      </div>
    </div>
  );
}
