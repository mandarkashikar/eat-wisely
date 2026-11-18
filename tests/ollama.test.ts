import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { UserProfile, MenuFixture } from "./evals/types";
import { analyzeMenuWithOllama } from "../lib/agent";
import { evaluateMenuAnalysis } from "./evals/evaluator";

describe("Eat Wisely Ollama (llama3.2) Integration & Safety", () => {
  const profilePath = path.resolve(process.cwd(), "data/profiles/example-profile.json");
  const fixturesPath = path.resolve(process.cwd(), "tests/fixtures/menus.json");

  const profile: UserProfile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
  const fixtures: MenuFixture[] = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

  it("should analyze the Thai menu with zero false negatives for fish oil/sauce", async () => {
    const thaiFixture = fixtures.find((f) => f.id === "thai_street_bistro")!;
    const analysis = await analyzeMenuWithOllama(thaiFixture.menuText, profile);
    const evalResult = evaluateMenuAnalysis(thaiFixture, {
      menuId: thaiFixture.id,
      menuName: thaiFixture.name,
      ...analysis,
    });

    expect(
      evalResult.hardAllergenFalseNegatives,
      `Missed hard allergens: ${evalResult.hardAllergenFalseNegatives.join(", ")}`
    ).toEqual([]);
    expect(evalResult.safetyPassed).toBe(true);
  }, 60000); // 60s timeout for local model inference
});
