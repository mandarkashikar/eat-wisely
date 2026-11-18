import fs from "fs";
import path from "path";
import { UserProfile, MenuFixture } from "./types";
import { analyzeMenuWithOllama } from "../../lib/agent";
import { evaluateMenuAnalysis, generateSummary } from "./evaluator";

async function runOllamaEvals() {
  console.log("==================================================");
  console.log("       EAT WISELY - OLLAMA (LLAMA 3.2) EVALS      ");
  console.log("==================================================\n");

  const profilePath = path.resolve(process.cwd(), "data/profiles/example-profile.json");
  const fixturesPath = path.resolve(process.cwd(), "tests/fixtures/menus.json");

  const profile: UserProfile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
  const fixtures: MenuFixture[] = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

  const results = [];

  for (const fixture of fixtures) {
    console.log(`--------------------------------------------------`);
    console.log(`Analyzing: ${fixture.name} (${fixture.cuisine})`);

    const start = Date.now();
    try {
      const analysis = await analyzeMenuWithOllama(fixture.menuText, profile);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`Analysis completed in ${duration}s`);
      console.log(`- Hard Allergens: ${JSON.stringify(analysis.hardAllergenItems)}`);
      console.log(`- Avoid Items:    ${JSON.stringify(analysis.avoidItems)}`);
      console.log(`- Top Picks:      ${JSON.stringify(analysis.topRecommendedItems)}`);
      if (analysis.summaryNote) {
        console.log(`- Note:           ${analysis.summaryNote}`);
      }

      const evalResult = evaluateMenuAnalysis(fixture, {
        menuId: fixture.id,
        menuName: fixture.name,
        ...analysis,
      });
      results.push(evalResult);

      for (const note of evalResult.notes) {
        console.log(`  ${note}`);
      }
    } catch (err) {
      console.error(`Error analyzing ${fixture.name}:`, err);
    }
  }

  const summary = generateSummary(results);
  console.log("\n==================================================");
  console.log("             OLLAMA EVALUATION SUMMARY            ");
  console.log("==================================================");
  console.log(`Safety Pass Rate:           ${(summary.safetyPassRate * 100).toFixed(1)}%`);
  console.log(`Critical Safety Violations: ${summary.criticalSafetyViolations}`);
  console.log(`Average Avoid Recall:       ${(summary.averageAvoidRecall * 100).toFixed(1)}%`);
  console.log(`Average Top Picks Accuracy: ${(summary.averageTopPicksAccuracy * 100).toFixed(1)}%`);
  console.log("==================================================\n");
}

runOllamaEvals().catch(console.error);

