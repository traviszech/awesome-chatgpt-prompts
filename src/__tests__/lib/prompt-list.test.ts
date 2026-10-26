import { describe, it, expect } from "vitest";
import { NON_BOT_PROMPTS, promptListTypeWhere } from "@/lib/prompt-list";

describe("promptListTypeWhere", () => {
  it("excludes bots when no type is requested", () => {
    expect(promptListTypeWhere()).toEqual({ type: { not: "BOT" } });
    expect(promptListTypeWhere(null)).toEqual(NON_BOT_PROMPTS);
    expect(promptListTypeWhere("")).toEqual(NON_BOT_PROMPTS);
  });

  it("uses the requested type, including BOT", () => {
    expect(promptListTypeWhere("IMAGE")).toEqual({ type: "IMAGE" });
    expect(promptListTypeWhere("BOT")).toEqual({ type: "BOT" });
  });
});
