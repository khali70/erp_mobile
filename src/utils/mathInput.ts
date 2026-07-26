import { normalizeDigits } from './numerals';

/**
 * Quick-math for numeric inputs: lets an owner type `50*3` or `1200/4` in a price
 * or quantity box and get the product/quotient. ONLY `*` and `/` are honoured — a
 * price box is not a calculator and `+`/`-` invite ambiguity with signed amounts.
 *
 * Reuses `normalizeDigits`, so Arabic-Indic digits and grouped figures parse the
 * same way the rest of the money path parses them (see numerals.ts — a money box
 * that half-reads a number is worse than one that refuses it).
 *
 * Precision: money is stored as integer minor units and rounded once at `toMinor`.
 * All this does is strip binary-float artifacts (`0.1*3` → `0.3`, not
 * `0.30000000000000004`) via `toPrecision(12)` so the committed/displayed major
 * value is clean.
 *
 * @returns the evaluated number, or `NaN` for empty / malformed / divide-by-zero
 *          input. Callers keep their existing `Number.isFinite ? n : 0` guard.
 */
export function evaluateNumeric(raw: string): number {
  const s = normalizeDigits(raw).trim();
  if (!s) return NaN;

  // Only digits, a dot, and the two operators are allowed. Anything else
  // (letters, `+`, `-`, `(`, ...) is rejected rather than silently truncated.
  if (!/^[0-9.*/]+$/.test(s)) return NaN;

  if (!hasMathOperator(s)) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // Fold operands left-to-right, equal precedence: `50/2*3` → 75.
  const tokens = s.split(/([*/])/);
  let acc = parseFloat(tokens[0]);
  if (!Number.isFinite(acc)) return NaN;

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const operand = parseFloat(tokens[i + 1]);
    if (!Number.isFinite(operand)) return NaN;
    if (op === '*') acc *= operand;
    else {
      if (operand === 0) return NaN; // divide-by-zero
      acc /= operand;
    }
  }

  if (!Number.isFinite(acc)) return NaN;
  return Number(acc.toPrecision(12));
}

/** True if the (already-typed) text contains a `*` or `/` — cheap blur-commit gate. */
export function hasMathOperator(raw: string): boolean {
  return /[*/]/.test(raw);
}
