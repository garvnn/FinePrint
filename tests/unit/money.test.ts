import { describe, expect, it } from "vitest";
import { findDayCounts, findLeaseTermMonths, findMoney, findMonthsOfRent, formatUSD, parseNumberWord } from "@/lib/analysis/money";

describe("findMoney", () => {
  it("parses dollar amounts with commas and cents", () => {
    expect(findMoney("rent of $1,800.00 per month").map((m) => m.amount)).toEqual([1800]);
    expect(findMoney("a fee of $75").map((m) => m.amount)).toEqual([75]);
    expect(findMoney("$ 2,700.50 deposit").map((m) => m.amount)).toEqual([2700.5]);
  });
  it("finds multiple values in order with offsets", () => {
    const text = "first $1,800.00; last $1,800.00; deposit $2,700.00; fee $350.00";
    const m = findMoney(text);
    expect(m.map((x) => x.amount)).toEqual([1800, 1800, 2700, 350]);
    for (const x of m) expect(text.slice(x.start, x.end)).toBe(x.raw);
  });
  it("supports 'N dollars' phrasing", () => {
    expect(findMoney("a charge of 50 dollars").map((m) => m.amount)).toEqual([50]);
  });
  it("returns nothing when no amount is present", () => {
    expect(findMoney("Rent is set out in a separate schedule.")).toEqual([]);
  });
});

describe("number words and durations", () => {
  it("parses number words and parentheticals", () => {
    expect(parseNumberWord("twelve")).toBe(12);
    expect(parseNumberWord("twelve (12)")).toBe(12);
    expect(parseNumberWord("one and one-half")).toBe(1.5);
    expect(parseNumberWord("banana")).toBeNull();
  });
  it("finds months-of-rent expressions", () => {
    expect(findMonthsOfRent("a fee equal to two (2) months' rent")?.months).toBe(2);
    expect(findMonthsOfRent("equal to one and one-half months' rent")?.months).toBe(1.5);
    expect(findMonthsOfRent("no relative amount")).toBeNull();
  });
  it("finds day counts", () => {
    expect(findDayCounts("within five (5) days after").map((d) => d.days)).toEqual([5]);
    expect(findDayCounts("at least ninety (90) days before").map((d) => d.days)).toEqual([90]);
  });
  it("finds lease term from explicit months or date ranges", () => {
    expect(findLeaseTermMonths("The term of this Lease is twelve (12) months")?.months).toBe(12);
    expect(findLeaseTermMonths("begins on June 1, 2026 and ends on May 31, 2027.")?.months).toBe(12);
    expect(findLeaseTermMonths("beginning 9/1/2026 and ending 2/28/2027")?.months).toBe(6);
    expect(findLeaseTermMonths("no term here")).toBeNull();
  });
  it("formats USD", () => {
    expect(formatUSD(1800)).toBe("$1,800");
    expect(formatUSD(1800.5)).toBe("$1,800.50");
    expect(formatUSD(null)).toBe("—");
  });
});
