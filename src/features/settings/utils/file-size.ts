/** Megabytes, one decimal, as a CANONICAL string ("12.4") for `toLocaleDigits`. */
export function toMegabytes(bytes: number): string {
  return (Math.max(0, bytes) / (1024 * 1024)).toFixed(1);
}
