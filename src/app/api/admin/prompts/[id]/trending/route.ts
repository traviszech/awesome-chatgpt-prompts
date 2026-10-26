import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { isTrending, resolveTrendingUntil, setTrendingSchema } from "@/lib/trending";

type RouteContext = { params: Promise<{ id: string }> };

function trendingResponse(prompt: { id: string; trendingUntil: Date | null }) {
  return NextResponse.json({
    success: true,
    id: prompt.id,
    isTrending: isTrending(prompt.trendingUntil),
    trendingUntil: prompt.trendingUntil,
  });
}

async function findPrompt(id: string) {
  return db.prompt.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
}

// POST /api/admin/prompts/[id]/trending - Mark a prompt as trending until a date
// Body: { days?: number } (default 3) or { until?: ISO 8601 date }
export async function POST(request: NextRequest, { params }: RouteContext) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  try {
    const { id } = await params;

    let body: unknown = {};
    const raw = await request.text();
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          { error: "invalid_request", message: "Body must be valid JSON" },
          { status: 400 }
        );
      }
    }

    const parsed = setTrendingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.issues[0]?.message ?? "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const resolved = resolveTrendingUntil(parsed.data);
    if ("error" in resolved) {
      return NextResponse.json(
        { error: "validation_error", message: resolved.error },
        { status: 400 }
      );
    }

    if (!(await findPrompt(id))) {
      return NextResponse.json({ error: "not_found", message: "Prompt not found" }, { status: 404 });
    }

    const prompt = await db.prompt.update({
      where: { id },
      data: { trendingUntil: resolved.until },
      select: { id: true, trendingUntil: true },
    });
    revalidateTag("prompts", "max");

    return trendingResponse(prompt);
  } catch (error) {
    console.error("Set trending error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update trending status" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/prompts/[id]/trending - Stop showing a prompt as trending
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  try {
    const { id } = await params;

    if (!(await findPrompt(id))) {
      return NextResponse.json({ error: "not_found", message: "Prompt not found" }, { status: 404 });
    }

    const prompt = await db.prompt.update({
      where: { id },
      data: { trendingUntil: null },
      select: { id: true, trendingUntil: true },
    });
    revalidateTag("prompts", "max");

    return trendingResponse(prompt);
  } catch (error) {
    console.error("Clear trending error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update trending status" },
      { status: 500 }
    );
  }
}
