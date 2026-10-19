import { describe, expect, test } from "bun:test";
import { addDays, hm, idr, isPeak, maskWa, ordinal, overlaps, priceFor, type PriceRule } from "../src/lib/padel";
import { normalizeWa } from "../src/lib/validate";

const indoor: PriceRule = { court_id: "c1", off_peak_idr: 350000, peak_idr: 550000, weekday_peak_start: 17, weekday_peak_end: 23, weekend_all_peak: true };

describe("formatting", () => {
  test("rupiah uses dots for thousands", () => {
    expect(idr(550000)).toBe("Rp 550.000");
    expect(idr(96800000)).toBe("Rp 96.800.000");
  });
  test("times use a dot and two digits", () => {
    expect(hm(20 * 60)).toBe("20.00");
    expect(hm(21 * 60 + 30)).toBe("21.30");
    expect(hm(6 * 60)).toBe("06.00");
  });
  test("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st"]);
  });
  test("WhatsApp numbers are masked in the middle", () => {
    expect(maskWa("0812 1100 2048")).toBe("0812 **** 2048");
  });
});

describe("peak and price", () => {
  // Thu 1 Oct 2026 is a weekday, Sat 3 Oct 2026 is a weekend.
  test("weekday evenings are peak, mornings are not", () => {
    expect(isPeak("2026-10-01", 20 * 60, indoor)).toBe(true);
    expect(isPeak("2026-10-01", 10 * 60, indoor)).toBe(false);
    expect(isPeak("2026-10-01", 23 * 60, indoor)).toBe(false);
  });
  test("weekends are peak all day", () => {
    expect(isPeak("2026-10-03", 9 * 60, indoor)).toBe(true);
  });
  test("price follows the length of play", () => {
    expect(priceFor(indoor, "2026-10-01", 20 * 60, 90)).toBe(825000);
    expect(priceFor(indoor, "2026-10-01", 10 * 60, 60)).toBe(350000);
    expect(priceFor(undefined, "2026-10-01", 10 * 60, 60)).toBe(0);
  });
});

describe("dates and overlap", () => {
  test("adds days across a month end", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });
  test("a slot overlapping a booking on the same court is taken", () => {
    const busy = [{ court_id: "c2", starts_at: "2026-10-02T20:00:00+07:00", ends_at: "2026-10-02T21:30:00+07:00" }];
    expect(overlaps(busy, "c2", "2026-10-02", 21 * 60, 60)).toBe(true);
    expect(overlaps(busy, "c2", "2026-10-02", 21 * 60 + 30, 60)).toBe(false);
    expect(overlaps(busy, "c1", "2026-10-02", 20 * 60, 60)).toBe(false);
  });
});

describe("WhatsApp numbers", () => {
  test("Indonesian numbers become 08 form", () => {
    expect(normalizeWa("+62 812 1100 2048")).toBe("081211002048");
    expect(normalizeWa("0812-1100-2048")).toBe("081211002048");
  });
  test("other country codes keep the plus", () => {
    expect(normalizeWa("+65 9123 4567")).toBe("+6591234567");
  });
  test("too short is rejected", () => {
    expect(normalizeWa("0812")).toBeNull();
  });
});
