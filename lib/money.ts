const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Parses a money string (e.g., "10.20", "10", "0.1") into exact integer cents (bigint).
 * Strictly rejects floating-point arithmetic, scientific notation, negative numbers,
 * or amounts with more than 2 decimal places.
 */
export function parseToCents(val: string): bigint {
  if (typeof val !== "string" || !MONEY_REGEX.test(val.trim())) {
    throw new Error(`Invalid money amount format: "${val}". Expected non-negative number with up to 2 decimal places.`);
  }

  const trimmed = val.trim();
  const parts = trimmed.split(".");
  const integerPart = BigInt(parts[0]);

  if (parts.length === 1) {
    return integerPart * 100n;
  }

  const decimalPart = parts[1];
  const paddedDecimal = decimalPart.padEnd(2, "0");
  const centsFromDecimal = BigInt(paddedDecimal);

  return integerPart * 100n + centsFromDecimal;
}

/**
 * Formats integer cents into a standard 2-decimal string (e.g., 1020n -> "10.20", 5n -> "0.05").
 */
export function formatCents(cents: bigint | number): string {
  const c = typeof cents === "bigint" ? cents : BigInt(cents);
  const isNegative = c < 0n;
  const abs = isNegative ? -c : c;
  const dollars = abs / 100n;
  const rem = abs % 100n;
  const formatted = `${dollars.toString()}.${rem.toString().padStart(2, "0")}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Sums an array of integer cents (bigint) safely without precision loss.
 */
export function sumCents(amounts: bigint[]): bigint {
  return amounts.reduce((acc, curr) => acc + curr, 0n);
}
