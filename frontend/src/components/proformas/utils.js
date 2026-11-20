
export const money = (value) =>
  "$" +
  Number(value || 0)
    .toFixed(2)
    .replace(/\.00$/, "");

export const round50 = (value) =>
  Math.round(Number(value || 0) * 2) / 2;
