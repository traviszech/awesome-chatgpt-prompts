import { describe, it, expect } from "vitest";
import {
  DEFAULT_TRENDING_DAYS,
  isTrending,
  resolveTrendingUntil,
  setTrendingSchema,
  trendingCutoff,
} from "@/lib/trending";

const NOW = Date.parse("2026-10-26T12:00:30.500Z");
const DAY = 24 * 60 * 60 * 1000;

describe("isTrending", () => {
  it("is false without a date", () => {
    expect(isTrending(null, NOW)).toBe(false);
    expect(isTrending(undefined, NOW)).toBe(false);
  });

  it("is true only while the date is in the future", () => {
    expect(isTrending(new Date(NOW + 1000), NOW)).toBe(true);
    expect(isTrending(new Date(NOW), NOW)).toBe(false);
    expect(isTrending(new Date(NOW - 1000), NOW)).toBe(false);
  });

  it("accepts serialized ISO strings", () => {
    expect(isTrending(new Date(NOW + DAY).toISOString(), NOW)).toBe(true);
    expect(isTrending("not a date", NOW)).toBe(false);
  });
});

describe("trendingCutoff", () => {
  it("rounds down to the minute", () => {
    expect(trendingCutoff(NOW).toISOString()).toBe("2026-10-26T12:00:00.000Z");
  });
});

describe("setTrendingSchema", () => {
  it("accepts an empty body, days or until", () => {
    expect(setTrendingSchema.safeParse({}).success).toBe(true);
    expect(setTrendingSchema.safeParse({ days: 7 }).success).toBe(true);
    expect(setTrendingSchema.safeParse({ until: "2026-11-01T00:00:00Z" }).success).toBe(true);
    expect(setTrendingSchema.safeParse({ until: "2026-11-01T00:00:00+03:00" }).success).toBe(true);
  });

  it("rejects both fields, bad values and unknown keys", () => {
    expect(setTrendingSchema.safeParse({ days: 1, until: "2026-11-01T00:00:00Z" }).success).toBe(false);
    expect(setTrendingSchema.safeParse({ days: 0 }).success).toBe(false);
    expect(setTrendingSchema.safeParse({ days: 1000 }).success).toBe(false);
    expect(setTrendingSchema.safeParse({ days: "3" }).success).toBe(false);
    expect(setTrendingSchema.safeParse({ until: "tomorrow" }).success).toBe(false);
    expect(setTrendingSchema.safeParse({ hours: 3 }).success).toBe(false);
  });
});

describe("resolveTrendingUntil", () => {
  it("defaults to three days from now", () => {
    expect(resolveTrendingUntil({}, NOW)).toEqual({ until: new Date(NOW + DEFAULT_TRENDING_DAYS * DAY) });
  });

  it("supports fractional days", () => {
    expect(resolveTrendingUntil({ days: 0.5 }, NOW)).toEqual({ until: new Date(NOW + DAY / 2) });
  });

  it("uses an explicit until date", () => {
    const until = "2026-11-01T00:00:00.000Z";
    expect(resolveTrendingUntil({ until }, NOW)).toEqual({ until: new Date(until) });
  });

  it("rejects until dates in the past or too far ahead", () => {
    expect(resolveTrendingUntil({ until: "2026-10-01T00:00:00Z" }, NOW)).toHaveProperty("error");
    expect(resolveTrendingUntil({ until: "2028-01-01T00:00:00Z" }, NOW)).toHaveProperty("error");
  });
});
