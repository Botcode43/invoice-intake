import { describe, it, expect } from "vitest";
import { parseToCents, formatCents, sumCents } from "@/lib/money";

describe("Money utility", () => {
  it("correctly parses valid money strings to exact integer cents", () => {
    expect(parseToCents("10.20")).toBe(1020n);
    expect(parseToCents("10")).toBe(1000n);
    expect(parseToCents("0.1")).toBe(10n);
    expect(parseToCents("0.10")).toBe(10n);
    expect(parseToCents("0.01")).toBe(1n);
    expect(parseToCents("0")).toBe(0n);
    expect(parseToCents("100.5")).toBe(10050n);
  });

  it("handles standard 0.10 + 0.20 == 0.30 without float rounding errors", () => {
    const a = parseToCents("0.10"); // 10n
    const b = parseToCents("0.20"); // 20n
    const totalExpected = parseToCents("0.30"); // 30n
    const totalMismatched = parseToCents("0.31"); // 31n

    const calculatedSum = sumCents([a, b]);

    expect(calculatedSum).toBe(totalExpected);
    expect(calculatedSum).not.toBe(totalMismatched);
  });

  it("rejects invalid money strings", () => {
    const invalidInputs = [
      "1.234",  // more than 2 decimal places
      "abc",    // not a number
      "-1",     // negative
      "-0.50",  // negative float
      "",       // empty
      "  ",     // whitespace only
      "1.",     // trailing decimal without digits
      ".5",     // leading decimal without integer
      "1e2",    // exponential notation
      "1,000",  // comma notation
    ];

    for (const input of invalidInputs) {
      expect(() => parseToCents(input)).toThrow();
    }
  });

  it("formats integer cents to 2-decimal string correctly", () => {
    expect(formatCents(1020n)).toBe("10.20");
    expect(formatCents(1000n)).toBe("10.00");
    expect(formatCents(30n)).toBe("0.30");
    expect(formatCents(5n)).toBe("0.05");
    expect(formatCents(0n)).toBe("0.00");
  });
});
