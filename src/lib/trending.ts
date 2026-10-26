import { z } from "zod";

export const DEFAULT_TRENDING_DAYS = 3;
export const MAX_TRENDING_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isTrending(
  trendingUntil: Date | string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!trendingUntil) return false;
  const until = new Date(trendingUntil).getTime();
  return Number.isFinite(until) && until > now;
}

/**
 * The current time rounded down to the minute, so cached list queries that
 * filter on trending share one cache entry per minute instead of one per request
 */
export function trendingCutoff(now: number = Date.now()): Date {
  return new Date(Math.floor(now / 60_000) * 60_000);
}

export function trendingWhere(now?: number) {
  return { trendingUntil: { gt: trendingCutoff(now) } };
}

export const setTrendingSchema = z
  .object({
    days: z.number().positive().max(MAX_TRENDING_DAYS).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((data) => !(data.days !== undefined && data.until !== undefined), {
    message: "Provide either days or until, not both",
  });

export type SetTrendingInput = z.infer<typeof setTrendingSchema>;

/**
 * Resolves the expiry for a trending request. Returns an error message when
 * `until` is not in the future or is further out than MAX_TRENDING_DAYS.
 */
export function resolveTrendingUntil(
  input: SetTrendingInput,
  now: number = Date.now()
): { until: Date } | { error: string } {
  if (input.until !== undefined) {
    const until = new Date(input.until);
    if (until.getTime() <= now) {
      return { error: "until must be in the future" };
    }
    if (until.getTime() > now + MAX_TRENDING_DAYS * DAY_MS) {
      return { error: `until must be within ${MAX_TRENDING_DAYS} days` };
    }
    return { until };
  }
  return { until: new Date(now + (input.days ?? DEFAULT_TRENDING_DAYS) * DAY_MS) };
}
