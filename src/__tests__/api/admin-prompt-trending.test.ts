import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/admin/prompts/[id]/trending/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidateTag } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    prompt: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const NOW = Date.parse("2026-10-26T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const API_KEY = `pchat_${"a".repeat(64)}`;
const params = { params: Promise.resolve({ id: "p1" }) };

function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/admin/prompts/p1/trending", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

function asAdminSession() {
  vi.mocked(auth).mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } } as never);
  vi.mocked(db.user.findUnique).mockResolvedValue({ id: "admin1", role: "ADMIN" } as never);
}

function promptExists() {
  vi.mocked(db.prompt.findFirst).mockResolvedValue({ id: "p1" } as never);
  vi.mocked(db.prompt.update).mockImplementation((async ({ data }: { data: { trendingUntil: Date | null } }) => ({
    id: "p1",
    trendingUntil: data.trendingUntil,
  })) as never);
}

describe("/api/admin/prompts/[id]/trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("auth", () => {
    it("returns 401 without a session or API key", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      const response = await POST(request("POST", {}), params);
      expect(response.status).toBe(401);
      expect(db.prompt.update).not.toHaveBeenCalled();
    });

    it("returns 403 for a non-admin session", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "USER" } } as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
      const response = await POST(request("POST", {}), params);
      expect(response.status).toBe(403);
    });

    it("re-checks the role in the database, not only the session", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "ADMIN" } } as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
      const response = await POST(request("POST", {}), params);
      expect(response.status).toBe(403);
    });

    it("accepts an admin API key as a bearer token", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "admin1", role: "ADMIN" } as never);
      promptExists();
      const response = await POST(request("POST", { days: 1 }, { Authorization: `Bearer ${API_KEY}` }), params);
      expect(response.status).toBe(200);
      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { apiKey: API_KEY }, select: { id: true, role: true } });
    });

    it("accepts an admin API key in x-api-key", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "admin1", role: "ADMIN" } as never);
      promptExists();
      const response = await DELETE(request("DELETE", undefined, { "x-api-key": API_KEY }), params);
      expect(response.status).toBe(200);
    });

    it("rejects a non-admin API key", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: "u1", role: "USER" } as never);
      const response = await POST(request("POST", {}, { "x-api-key": API_KEY }), params);
      expect(response.status).toBe(403);
    });

    it("ignores malformed API keys without querying the database", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);
      const response = await POST(request("POST", {}, { "x-api-key": "nope" }), params);
      expect(response.status).toBe(401);
      expect(db.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    beforeEach(() => {
      asAdminSession();
      promptExists();
    });

    it("defaults to three days and revalidates prompt lists", async () => {
      const response = await POST(request("POST"), params);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toMatchObject({ success: true, id: "p1", isTrending: true });
      expect(data.trendingUntil).toBe(new Date(NOW + 3 * DAY).toISOString());
      expect(revalidateTag).toHaveBeenCalledWith("prompts", "max");
    });

    it("uses days", async () => {
      const data = await (await POST(request("POST", { days: 7 }), params)).json();
      expect(data.trendingUntil).toBe(new Date(NOW + 7 * DAY).toISOString());
    });

    it("uses until", async () => {
      const until = "2026-10-30T09:00:00.000Z";
      const data = await (await POST(request("POST", { until }), params)).json();
      expect(data.trendingUntil).toBe(until);
    });

    it("returns 400 for invalid JSON", async () => {
      const response = await POST(request("POST", "{not json"), params);
      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid input", async () => {
      expect((await POST(request("POST", { days: -1 }), params)).status).toBe(400);
      expect((await POST(request("POST", { days: 1, until: "2026-10-30T00:00:00Z" }), params)).status).toBe(400);
      expect((await POST(request("POST", { until: "2026-10-01T00:00:00Z" }), params)).status).toBe(400);
      expect(db.prompt.update).not.toHaveBeenCalled();
    });

    it("returns 404 for a missing or deleted prompt", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      const response = await POST(request("POST", {}), params);
      expect(response.status).toBe(404);
      expect(db.prompt.findFirst).toHaveBeenCalledWith({ where: { id: "p1", deletedAt: null }, select: { id: true } });
    });
  });

  describe("DELETE", () => {
    beforeEach(() => {
      asAdminSession();
      promptExists();
    });

    it("clears trendingUntil", async () => {
      const response = await DELETE(request("DELETE"), params);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toMatchObject({ success: true, isTrending: false, trendingUntil: null });
      expect(db.prompt.update).toHaveBeenCalledWith(expect.objectContaining({ data: { trendingUntil: null } }));
      expect(revalidateTag).toHaveBeenCalledWith("prompts", "max");
    });

    it("returns 404 for a missing prompt", async () => {
      vi.mocked(db.prompt.findFirst).mockResolvedValue(null);
      expect((await DELETE(request("DELETE"), params)).status).toBe(404);
    });
  });
});
