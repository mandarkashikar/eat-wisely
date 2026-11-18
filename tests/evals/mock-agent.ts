import { UserProfile, MenuAnalysisResult, MenuItemAnalysis } from "./types";

export function analyzeMenuWithBaselineAgent(
  menuId: string,
  menuName: string,
  menuText: string,
  profile: UserProfile
): MenuAnalysisResult {
  const lines = menuText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const hardAllergens = (profile.dietaryConstraints.hardAllergens || []).map(
    (a) => a.toLowerCase()
  );

  const itemAnalyses: MenuItemAnalysis[] = [];
  const hardAllergenItems: string[] = [];
  const avoidItems: string[] = [];

  for (const line of lines) {
    // Parse format like "1. Pad Thai - Rice noodles..." or "Pad Thai: Rice noodles..."
    const match = line.match(/^\d+[\.\)]\s*([^-:]+)[-:]\s*(.*)$/);
    const itemName = match ? match[1].trim() : line.split(/[-:]/)[0].trim();
    const itemDescription = match ? match[2].trim() : line;
    const fullTextLower = `${itemName} ${itemDescription}`.toLowerCase();

    // 1. Check Hard Allergens (e.g., fish oil, fish sauce)
    let hasHardAllergen = false;
    const allergenDetails: string[] = [];

    for (const allergen of hardAllergens) {
      // Check for exact allergen or related derivatives (e.g. fish oil, fish sauce, anchovy)
      const allergenTerms = [allergen];
      if (allergen.includes("fish")) {
        allergenTerms.push("fish sauce", "fish oil", "anchov");
      }
      for (const term of allergenTerms) {
        if (fullTextLower.includes(term)) {
          hasHardAllergen = true;
          allergenDetails.push(term);
        }
      }
    }

    if (hasHardAllergen) {
      hardAllergenItems.push(itemName);
    }

    // 2. Check Avoids / Dietary Constraints (e.g. cholesterol -> avoid fried)
    let isAvoid = false;
    let avoidReason = "";
    if (profile.dietaryConstraints.cholesterolConscious) {
      const friedTerms = ["deep-fried", "fried", "crispy spring rolls", "fritti", "fritto", "battered"];
      for (const term of friedTerms) {
        if (fullTextLower.includes(term)) {
          isAvoid = true;
          avoidReason = "Fried food (cholesterol-conscious avoid)";
          break;
        }
      }
    }

    if (isAvoid) {
      avoidItems.push(itemName);
    }

    // 3. Scoring (1-10)
    let score = 5;
    if (hasHardAllergen) {
      score = 0;
    } else {
      if (isAvoid) {
        score -= 2;
      }

      // Check loves: spicy, dark chocolate, gianduja, Indian
      const spicyTerms = ["spicy", "fiery", "hot and sour", "jalapeño", "habanero", "chili", "curry", "arrabbiata"];
      const chocolateTerms = ["dark chocolate", "gianduja", "black sesame"];
      const grilledTerms = ["grilled", "flame-grilled", "roasted"];

      let matchBonus = 0;
      if (spicyTerms.some((t) => fullTextLower.includes(t))) {
        matchBonus += 3;
      }
      if (chocolateTerms.some((t) => fullTextLower.includes(t))) {
        matchBonus += 4;
      }
      if (grilledTerms.some((t) => fullTextLower.includes(t))) {
        matchBonus += 2;
      }

      score = Math.min(10, score + matchBonus);
    }

    itemAnalyses.push({
      name: itemName,
      hasHardAllergen,
      allergenDetails: allergenDetails.length > 0 ? allergenDetails : undefined,
      isAvoid,
      avoidReason: isAvoid ? avoidReason : undefined,
      score,
    });
  }

  // Top picks: highest scores, strictly excluding hard allergens
  const safeItems = itemAnalyses.filter((i) => !i.hasHardAllergen && !i.isAvoid);
  safeItems.sort((a, b) => b.score - a.score);
  const topRecommendedItems = safeItems.slice(0, 3).map((i) => i.name);

  return {
    menuId,
    menuName,
    hardAllergenItems,
    avoidItems,
    topRecommendedItems,
    items: itemAnalyses,
  };
}
