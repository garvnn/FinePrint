/** Pure text utilities for monetary amounts, numbers and durations. */

export interface MoneyMatch {
  amount: number;
  /** Offsets relative to the string that was scanned. */
  start: number;
  end: number;
  raw: string;
}

const MONEY_RE = /\$\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?!\d)|\b((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)\s+dollars\b/gi;

export function findMoney(text: string): MoneyMatch[] {
  const out: MoneyMatch[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const num = (m[1] ?? m[2] ?? "").replace(/,/g, "");
    const amount = Number.parseFloat(num);
    if (!Number.isFinite(amount)) continue;
    out.push({ amount: Math.round(amount * 100) / 100, start: m.index!, end: m.index! + m[0].length, raw: m[0] });
  }
  return out;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, "twenty-one": 21, "twenty-four": 24, thirty: 30,
  forty: 40, "forty-five": 45, fifty: 50, sixty: 60, seventy: 70, "seventy-five": 75, eighty: 80, ninety: 90,
  "one hundred twenty": 120, half: 0.5,
};

/** Parse "12", "twelve", "twelve (12)", "1.5", "one and one-half". */
export function parseNumberWord(s: string): number | null {
  const t = s.trim().toLowerCase();
  const paren = t.match(/\((\d+(?:\.\d+)?)\)/);
  if (paren) return Number(paren[1]);
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const andHalf = t.match(/^([a-z-]+)\s+and\s+(?:one-?|a\s+)half$/);
  if (andHalf && NUMBER_WORDS[andHalf[1]] !== undefined) return NUMBER_WORDS[andHalf[1]] + 0.5;
  if (NUMBER_WORDS[t] !== undefined) return NUMBER_WORDS[t];
  return null;
}

const NUM_TOKEN =
  "(\\d+(?:\\.\\d+)?|(?:[a-z]+(?:-[a-z]+)?)(?:\\s+and\\s+(?:one-?|a\\s+)half)?)(?:\\s*\\((\\d+(?:\\.\\d+)?)\\))?";

/** Find "<N> month(s)' rent" style expressions; returns the multiplier. */
export function findMonthsOfRent(text: string): { months: number; start: number; end: number; raw: string } | null {
  const re = new RegExp(`${NUM_TOKEN}\\s+(?:full\\s+)?(?:calendar\\s+)?months?['’]?s?['’]?\\s+(?:of\\s+)?rent`, "i");
  const m = text.match(re);
  if (!m || m.index === undefined) return null;
  const months = m[2] ? Number(m[2]) : parseNumberWord(m[1]);
  if (months === null || months <= 0 || months > 24) return null;
  return { months, start: m.index, end: m.index + m[0].length, raw: m[0] };
}

/** Find "<N> days" (optionally "calendar"/"business"); returns all matches. */
export function findDayCounts(text: string): { days: number; index: number }[] {
  const re = new RegExp(`${NUM_TOKEN}\\s+(?:calendar\\s+|business\\s+)?days?\\b`, "gi");
  const out: { days: number; index: number }[] = [];
  for (const m of text.matchAll(re)) {
    const days = m[2] ? Number(m[2]) : parseNumberWord(m[1]);
    if (days !== null && days > 0 && days <= 366) out.push({ days, index: m.index! });
  }
  return out;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseDate(s: string): Date | null {
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    if (mi >= 0) return new Date(Date.UTC(Number(m[3]), mi, Number(m[2])));
  }
  const n = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (n) return new Date(Date.UTC(Number(n[3]), Number(n[1]) - 1, Number(n[2])));
  return null;
}

/** Lease term in months from "term of twelve (12) months" or a start/end date range. */
export function findLeaseTermMonths(text: string): { months: number; start: number; end: number } | null {
  const explicit = new RegExp(`term\\b[^.]{0,40}?\\b(?:of\\s+)?${NUM_TOKEN}\\s+months?`, "i");
  const m = text.match(explicit);
  if (m && m.index !== undefined) {
    const months = m[2] ? Number(m[2]) : parseNumberWord(m[1]);
    if (months && months >= 1 && months <= 60) return { months, start: m.index, end: m.index + m[0].length };
  }
  const DATE = "([A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4})";
  const range = new RegExp(`(?:beginning|begins|commencing|commences|starting|starts|from)\\s+(?:on\\s+)?${DATE}[^.]{0,40}?(?:ending|ends|through|until|to)\\s+(?:on\\s+)?${DATE}`, "i");
  const r = text.match(range);
  if (r && r.index !== undefined) {
    const a = parseDate(r[1]);
    const b = parseDate(r[2]);
    if (a && b && b > a) {
      const months = Math.round(((b.getTime() - a.getTime()) / 86_400_000 + 1) / 30.44);
      if (months >= 1 && months <= 60) return { months, start: r.index, end: r.index + r[0].length };
    }
  }
  return null;
}

export function formatUSD(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const cents = opts.cents ?? !Number.isInteger(n);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}
