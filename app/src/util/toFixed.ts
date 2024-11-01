// https://stackoverflow.com/a/11818658/10499803
export default function toFixed(num: number, fixed: number): string {
  const re = new RegExp("^-?\\d+(?:.\\d{0," + (fixed || -1) + "})?");
  return num.toString().match(re)![0];
}
