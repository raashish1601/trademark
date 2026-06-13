import { describe, expect, it } from "vitest";
import {
  QUOTE_BODY_MAX,
  isReshare,
  normalizeQuoteBody,
  reshareCountLabel,
  resolveReshareTarget,
} from "./reshare";
import { createReshareSchema } from "./schemas";
import { groupVerb } from "./notifications";

describe("resolveReshareTarget", () => {
  it("references the target directly when it is an original (no quotePostId)", () => {
    expect(resolveReshareTarget("p1", null)).toBe("p1");
    expect(resolveReshareTarget("p1", undefined)).toBe("p1");
  });
  it("collapses to the root when the target is itself a reshare", () => {
    // Resharing a reshare (r1 → root) must reference root, never r1.
    expect(resolveReshareTarget("r1", "root")).toBe("root");
  });
});

describe("normalizeQuoteBody", () => {
  it("trims commentary and treats whitespace-only as a plain reshare", () => {
    expect(normalizeQuoteBody("  hello  ")).toBe("hello");
    expect(normalizeQuoteBody("   ")).toBe("");
    expect(normalizeQuoteBody(null)).toBe("");
    expect(normalizeQuoteBody(undefined)).toBe("");
  });
  it("caps overly long commentary at the body max", () => {
    const long = "x".repeat(QUOTE_BODY_MAX + 50);
    expect(normalizeQuoteBody(long).length).toBe(QUOTE_BODY_MAX);
  });
});

describe("isReshare", () => {
  it("is true only when quotePostId is set", () => {
    expect(isReshare({ quotePostId: "p1" })).toBe(true);
    expect(isReshare({ quotePostId: null })).toBe(false);
    expect(isReshare({})).toBe(false);
  });
});

describe("reshareCountLabel", () => {
  it("pluralizes correctly", () => {
    expect(reshareCountLabel(0)).toBe("0 reshares");
    expect(reshareCountLabel(1)).toBe("1 reshare");
    expect(reshareCountLabel(4)).toBe("4 reshares");
  });
});

describe("createReshareSchema", () => {
  it("accepts a plain reshare (no body)", () => {
    expect(createReshareSchema.safeParse({ targetId: "p1" }).success).toBe(true);
  });
  it("accepts a quote with commentary", () => {
    expect(createReshareSchema.safeParse({ targetId: "p1", body: "nice" }).success).toBe(true);
  });
  it("rejects a missing targetId", () => {
    expect(createReshareSchema.safeParse({ body: "nice" }).success).toBe(false);
  });
  it("rejects commentary over 5000 chars", () => {
    expect(createReshareSchema.safeParse({ targetId: "p1", body: "x".repeat(5001) }).success).toBe(
      false
    );
  });
});

describe("reshare notification copy", () => {
  it("reads naturally for a reshare group", () => {
    expect(groupVerb({ type: "reshare" })).toBe("reshared your post");
  });
});
