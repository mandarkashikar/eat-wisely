export interface UserProfile {
  name: string;
  note?: string;
  allergensAndAvoids: string[];
  loves: string[];
  dietaryConstraints: {
    cholesterolConscious?: boolean;
    hardAllergens: string[];
  };
  crossCuisinePreferenceHints: string[];
}

export interface MenuItemAnalysis {
  name: string;
  hasHardAllergen: boolean;
  allergenDetails?: string[];
  isAvoid: boolean;
  avoidReason?: string;
  score: number; // 1-10
  rationale?: string;
}

export interface MenuAnalysisResult {
  menuId: string;
  menuName: string;
  hardAllergenItems: string[];
  avoidItems: string[];
  topRecommendedItems: string[];
  items?: MenuItemAnalysis[];
}

export interface ExpectedMenuResult {
  hardAllergenItems: string[];
  avoidItems: string[];
  topRecommendedItems: string[];
  rationale?: string;
}

export interface MenuFixture {
  id: string;
  cuisine: string;
  name: string;
  menuText: string;
  expectedResults: ExpectedMenuResult;
}

export interface EvalReportItem {
  menuId: string;
  menuName: string;
  safetyPassed: boolean; // Zero false negatives on hard allergens
  hardAllergenFalseNegatives: string[]; // CRITICAL safety violations
  hardAllergenFalsePositives: string[];
  avoidRecall: number; // 0-1
  topPicksOverlap: string[];
  topPicksExpected: string[];
  notes: string[];
}

export interface OverallEvalSummary {
  timestamp: string;
  totalMenusTested: number;
  safetyPassRate: number; // Must be 100% (0 false negatives)
  criticalSafetyViolations: number;
  averageAvoidRecall: number;
  averageTopPicksAccuracy: number;
  results: EvalReportItem[];
}

