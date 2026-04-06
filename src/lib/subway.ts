/** Korean subway official line colors (Seoul Metro + AREX + Shinbundang) */
export const LINE_COLORS: Record<number, string> = {
  1: "#0052A4",
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#00A5DE",
  5: "#996CAC",
  6: "#CD7C2F",
  7: "#747F00",
  8: "#E6186C",
  9: "#BDB092",
};

export function getLineColor(line: number): string {
  return LINE_COLORS[line] ?? "#888888";
}
