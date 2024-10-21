import clsx from "clsx";

export default function CoinPlaceholder() {
  return (
    <div className="grid grid-areas-coin grid-cols-coin grid-rows-coin place-items-center select-none">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className={clsx(
            [
              "grid-in-a1",
              "grid-in-a2",
              "grid-in-a3",
              "grid-in-a4",
              "grid-in-a5 translate-x-1.5 translate-y-1.5",
              "grid-in-a6 -translate-x-1.5 translate-y-1.5",
              "grid-in-a7 -translate-x-1.5 -translate-y-1.5",
              "grid-in-a8 translate-x-1.5 -translate-y-1.5",
            ][i],
            "text-2xl"
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
              "grid-in-w5 place-self-end",
              "grid-in-w6 justify-self-start self-end",
              "grid-in-w7 place-self-start",
              "grid-in-w8 justify-self-end self-start",
            ][i],
            "text-4xl"
          )}
        >
          <span className="blur">何</span>
          <span> </span>
        </div>
      ))}
      <div className={clsx("grid-in-qq text-5xl")}>
        <span>？</span>
        <span> </span>
      </div>
    </div>
  );
}
