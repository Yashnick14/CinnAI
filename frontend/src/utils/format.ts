export const percent = (n: number | null) =>
  n === null ? "Unavailable" : `${(n * 100).toFixed(1)}%`;
export const measurement = (n: number | null, unit: string) =>
  n === null ? "Unavailable" : `${n.toFixed(1)} ${unit}`;
export const dateTime = (s: string) => new Date(s).toLocaleString();
export const statusLabel = (s: string) => s.replace(/_/g, " ");
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
