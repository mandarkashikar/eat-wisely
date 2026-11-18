import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { UserProfile, MenuFixture } from "./evals/types";
import { analyzeMenuWithBaselineAgent } from "./evals/mock-agent";
import { evaluateMenuAnalysis } from "./evals/evaluator";
import { checkHardAllergens } from "../lib/safety";

describe("Eat Wisely Agent & Safety Evaluation Suite", () => {
  const profilePath = path.resolve(process.cwd(), "data/profiles/example-profile.json");
  const fixturesPath = path.resolve(process.cwd(), "tests/fixtures/menus.json");

  const profile: UserProfile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
  const fixtures: MenuFixture[] = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

  it("should have zero false negatives on hard allergens across all menus", () => {
    for (const fixture of fixtures) {
      const result = analyzeMenuWithBaselineAgent(
        fixture.id,
        fixture.name,
        fixture.menuText,
        profile
      );
      const evalResult = evaluateMenuAnalysis(fixture, result);

      expect(
        evalResult.hardAllergenFalseNegatives,
        `Menu '${fixture.name}' failed allergen safety! Missed: ${evalResult.hardAllergenFalseNegatives.join(", ")}`
      ).toEqual([]);
      expect(evalResult.safetyPassed).toBe(true);
    }
  });

  it("should flag avoid items without treating them as hard allergens", () => {
    for (const fixture of fixtures) {
      const result = analyzeMenuWithBaselineAgent(
        fixture.id,
        fixture.name,
        fixture.menuText,
        profile
      );
      const evalResult = evaluateMenuAnalysis(fixture, result);

      expect(evalResult.avoidRecall).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("should rank top picks aligned with user preferences", () => {
    for (const fixture of fixtures) {
      const result = analyzeMenuWithBaselineAgent(
        fixture.id,
        fixture.name,
        fixture.menuText,
        profile
      );
      const evalResult = evaluateMenuAnalysis(fixture, result);

      expect(evalResult.topPicksOverlap.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should support multiple selectable options with substitution advice for avoid items", () => {
    // For Bangkok Street Bistro, Spring Rolls are fried (avoid item)
    // A substitution (e.g. fresh/steamed or grilled) enables it as a selectable option
    const thaiFixture = fixtures.find((f) => f.id === "thai_street_bistro")!;
    const result = analyzeMenuWithBaselineAgent(
      thaiFixture.id,
      thaiFixture.name,
      thaiFixture.menuText,
      profile
    );

    expect(result.topRecommendedItems.length).toBeGreaterThanOrEqual(2);
    // Hard allergens must never be recommended
    for (const item of result.topRecommendedItems) {
      expect(result.hardAllergenItems).not.toContain(item);
    }
  });

  it("should deterministically detect chicken, peanuts, and other hard allergens in dish names", () => {
    // Exact user case: user added chicken and peanuts as hard allergens
    const chickenPeanutResult = checkHardAllergens(
      "Grilled Chicken Skewers with Peanut Sauce",
      ["Peanuts", "Fish Sauce", "chicken"]
    );

    expect(chickenPeanutResult.hasAllergen).toBe(true);
    expect(chickenPeanutResult.matchedAllergens).toContain("chicken");
    expect(chickenPeanutResult.matchedAllergens).toContain("Peanuts");

    // Single chicken check
    const chickenOnly = checkHardAllergens("Green Curry Chicken", ["chicken"]);
    expect(chickenOnly.hasAllergen).toBe(true);

    // Negative check: dish with beef should not match chicken allergen
    const safeDish = checkHardAllergens("Carne Asada Platter with rice", ["chicken", "peanuts"]);
    expect(safeDish.hasAllergen).toBe(false);
  });
});
