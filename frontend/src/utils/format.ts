/** Format an available fractional confidence as a percentage. */
export const percent = (n: number | null) =>
  n === null ? "Unavailable" : `${(n * 100).toFixed(1)}%`;

/** Format an available numeric measurement with its unit. */
export const measurement = (n: number | null, unit: string) =>
  n === null ? "Unavailable" : `${n.toFixed(1)} ${unit}`;

/** Format a timestamp for the user's locale. */
export const dateTime = (s: string) => new Date(s).toLocaleString();

/** Normalize a status label for presentation. */
export const statusLabel = (s: string) => s.replace(/_/g, " ");

/** Extract a user-facing message from an unknown error value. */
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
