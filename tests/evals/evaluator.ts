import {
  MenuFixture,
  MenuAnalysisResult,
  EvalReportItem,
  OverallEvalSummary,
} from "./types";

export function evaluateMenuAnalysis(
  fixture: MenuFixture,
  result: MenuAnalysisResult
): EvalReportItem {
  const normalize = (name: string) => name.trim().toLowerCase();

  const expectedHard = fixture.expectedResults.hardAllergenItems;
  const actualHard = result.hardAllergenItems;

  const actualHardNormalized = actualHard.map(normalize);
  const falseNegatives = expectedHard.filter(
    (exp) => !actualHardNormalized.includes(normalize(exp))
  );

  const expectedHardNormalized = expectedHard.map(normalize);
  const falsePositives = actualHard.filter(
    (act) => !expectedHardNormalized.includes(normalize(act))
  );

  const safetyPassed = falseNegatives.length === 0;

  // Avoid items
  const expectedAvoid = fixture.expectedResults.avoidItems;
  const actualAvoid = result.avoidItems;
  const actualAvoidNormalized = actualAvoid.map(normalize);
  const avoidOverlap = expectedAvoid.filter((exp) =>
    actualAvoidNormalized.includes(normalize(exp))
  );
  const avoidRecall =
    expectedAvoid.length === 0 ? 1 : avoidOverlap.length / expectedAvoid.length;

  // Top picks
  const expectedTop = fixture.expectedResults.topRecommendedItems;
  const actualTop = result.topRecommendedItems;
  const actualTopNormalized = actualTop.map(normalize);
  const topPicksOverlap = expectedTop.filter((exp) =>
    actualTopNormalized.includes(normalize(exp))
  );

  const notes: string[] = [];
  if (!safetyPassed) {
    notes.push(
      `🚨 CRITICAL SAFETY FAILURE: Missed allergen items: [${falseNegatives.join(
        ", "
      )}]`
    );
  } else {
    notes.push("✅ Allergen safety passed (0 false negatives)");
  }

  if (avoidRecall < 1) {
    notes.push(
      `⚠️ Missed dietary avoid items (${Math.round(avoidRecall * 100)}% recall)`
    );
  } else {
    notes.push("✅ All avoid items correctly identified");
  }

  return {
    menuId: fixture.id,
    menuName: fixture.name,
    safetyPassed,
    hardAllergenFalseNegatives: falseNegatives,
    hardAllergenFalsePositives: falsePositives,
    avoidRecall,
    topPicksOverlap,
    topPicksExpected: expectedTop,
    notes,
  };
}

export function generateSummary(
  results: EvalReportItem[]
): OverallEvalSummary {
  const total = results.length;
  const passedSafety = results.filter((r) => r.safetyPassed).length;
  const criticalViolations = results.reduce(
    (acc, r) => acc + r.hardAllergenFalseNegatives.length,
    0
  );

  const avgAvoidRecall =
    results.reduce((acc, r) => acc + r.avoidRecall, 0) / (total || 1);

  const avgTopPicksAcc =
    results.reduce((acc, r) => {
      const expectedCount = r.topPicksExpected.length;
      return (
        acc +
        (expectedCount === 0 ? 1 : r.topPicksOverlap.length / expectedCount)
      );
    }, 0) / (total || 1);

  return {
    timestamp: new Date().toISOString(),
    totalMenusTested: total,
    safetyPassRate: total === 0 ? 1 : passedSafety / total,
    criticalSafetyViolations: criticalViolations,
    averageAvoidRecall: avgAvoidRecall,
    averageTopPicksAccuracy: avgTopPicksAcc,
    results,
  };
}
