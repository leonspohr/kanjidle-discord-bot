/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      gridTemplateAreas: {
        coin: [
          "w5 .  w1 .  w6",
          ".  a5 a1 a6 . ",
          "w4 a4 qq a2 w2",
          ".  a8 a3 a7 . ",
          "w8 .  w3 .  w7",
        ],
      },
      gridTemplateColumns: {
        coin: "4rem 2rem 4rem 2rem 4rem",
      },
      gridTemplateRows: {
        coin: "4rem 2rem 4rem 2rem 4rem",
      },
    },
  },
  plugins: [require("@savvywombat/tailwindcss-grid-areas")],
};
