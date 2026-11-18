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

export interface RecommendedDish {
  name: string;
  whyItWorksForYou: string;
  safetyConfidence?: string;
  matchedPreferences?: string[];
  score?: number;
  optionType?: "ready_as_is" | "with_substitution";
  substitutionAdvice?: string;
}

export interface MenuItemAnalysis {
  name: string;
  hasHardAllergen: boolean;
  allergenDetails?: string[];
  isAvoid: boolean;
  avoidReason?: string;
  score: number; // 1-10
  rationale?: string;
  whyItWorksForYou?: string;
  matchedPreferences?: string[];
  optionType?: "ready_as_is" | "with_substitution";
  substitutionAdvice?: string;
}

export interface MenuAnalysisResult {
  menuId?: string;
  menuName?: string;
  hardAllergenItems: string[];
  avoidItems: string[];
  topRecommendedItems: string[];
  topRecommendations?: RecommendedDish[];
  items?: MenuItemAnalysis[];
  summaryNote?: string;
}
