import fs from "fs";
import path from "path";
import { UserProfile, MenuFixture } from "./types";
import { analyzeMenuWithBaselineAgent } from "./mock-agent";
import { evaluateMenuAnalysis, generateSummary } from "./evaluator";

function run() {
  console.log("==================================================");
  console.log("       EAT WISELY - AGENT EVALUATION RUNNER       ");
  console.log("==================================================\n");

  const profilePath = path.resolve(
    process.cwd(),
    "data/profiles/example-profile.json"
  );
  const fixturesPath = path.resolve(
    process.cwd(),
    "tests/fixtures/menus.json"
  );

  const profile: UserProfile = JSON.parse(
    fs.readFileSync(profilePath, "utf-8")
  );
  const fixtures: MenuFixture[] = JSON.parse(
    fs.readFileSync(fixturesPath, "utf-8")
  );

  console.log(`Evaluating against profile: ${profile.name}`);
  console.log(`Hard allergens to flag: [${profile.dietaryConstraints.hardAllergens.join(", ")}]`);
  console.log(`Avoid constraints: [${profile.allergensAndAvoids.join("; ")}]`);
  console.log(`Total test menus: ${fixtures.length}\n`);

  const reportItems = [];

  for (const fixture of fixtures) {
    console.log(`--------------------------------------------------`);
    console.log(`Testing Menu: ${fixture.name} (${fixture.cuisine})`);

    const result = analyzeMenuWithBaselineAgent(
      fixture.id,
      fixture.name,
      fixture.menuText,
      profile
    );

    const evalResult = evaluateMenuAnalysis(fixture, result);
    reportItems.push(evalResult);

    console.log(`- Flagged Hard Allergens: ${JSON.stringify(result.hardAllergenItems)}`);
    console.log(`- Flagged Avoid Items:    ${JSON.stringify(result.avoidItems)}`);
    console.log(`- Top Recommended Picks:  ${JSON.stringify(result.topRecommendedItems)}`);
    for (const note of evalResult.notes) {
      console.log(`  ${note}`);
    }
  }

  const summary = generateSummary(reportItems);

  console.log("\n==================================================");
  console.log("                  EVAL SUMMARY                    ");
  console.log("==================================================");
  console.log(`Safety Pass Rate:           ${(summary.safetyPassRate * 100).toFixed(1)}% (Target: 100%)`);
  console.log(`Critical Safety Violations: ${summary.criticalSafetyViolations} (Target: 0)`);
  console.log(`Average Avoid Recall:       ${(summary.averageAvoidRecall * 100).toFixed(1)}%`);
  console.log(`Average Top Picks Accuracy: ${(summary.averageTopPicksAccuracy * 100).toFixed(1)}%`);
  console.log("==================================================\n");

  if (summary.criticalSafetyViolations > 0) {
    console.error("❌ EVAL SUITE FAILED: Hard allergen safety violation detected!");
    process.exit(1);
  } else {
    console.log("🎉 ALL SAFETY EVALS PASSED!");
  }
}

run();
