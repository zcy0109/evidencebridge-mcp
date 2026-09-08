import { describe, expect, it } from "vitest";
import { reviewBoundaryAnswer, shouldRequestReview } from "../lib/model-provider";

describe("human review boundary", () => {
  it("routes missing and unverified evidence", () => {
    expect(shouldRequestReview("What is the deadline?", 0, false)).toBe(true);
    expect(shouldRequestReview("What is the deadline?", 1, false)).toBe(true);
  });
  it("routes high-risk questions even with evidence", () => {
    expect(shouldRequestReview("Give me legal advice", 2, true)).toBe(true);
  });
  it("allows low-risk verified factual answers", () => {
    expect(shouldRequestReview("When are recordings available?", 2, true)).toBe(false);
  });
  it("does not present retrieved material as an answer before review", () => {
    expect(reviewBoundaryAnswer()).toContain("Human review is required");
    expect(reviewBoundaryAnswer()).toContain("not as an answer");
  });
});
