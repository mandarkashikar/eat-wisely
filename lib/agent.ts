import { UserProfile, MenuAnalysisResult, RecommendedDish } from "./types";
import { checkHardAllergens } from "./safety";

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

export async function analyzeMenuWithOllama(
  menuText: string,
  profile: UserProfile,
  options?: { baseUrl?: string; model?: string; restaurantContext?: string }
): Promise<MenuAnalysisResult> {
  const baseUrl = options?.baseUrl || DEFAULT_OLLAMA_URL;
  const model = options?.model || DEFAULT_OLLAMA_MODEL;

  const hardAllergens = (profile.dietaryConstraints?.hardAllergens || []).map((a) => a.trim()).filter(Boolean);

  const systemPrompt = `You are "Eat Wisely", an expert culinary safety and recommendation AI agent.
Analyze the restaurant menu or restaurant context against the diner's profile.

CRITICAL ALLERGEN SAFETY DIRECTIVE (ABSOLUTE 0-TOLERANCE):
- Hard allergens are NON-NEGOTIABLE LIFE-THREATENING CONTRAINDICATIONS.
- The diner's hard allergens are: ${hardAllergens.length > 0 ? hardAllergens.join(", ") : "None"}.
- If the diner is allergic to chicken, ANY dish made with or containing chicken, poultry, wings, drumsticks, tenders, or chicken broth is 100% DISQUALIFIED.
- If the diner is allergic to peanuts, ANY dish with peanuts, groundnuts, peanut sauce, or satay sauce is 100% DISQUALIFIED.
- If the diner is allergic to fish sauce or fish oil, ANY dish with fish sauce, fish oil, or anchovy is 100% DISQUALIFIED.
- NEVER, UNDER ANY CIRCUMSTANCES, recommend a dish that contains a hard allergen!
- NEVER recommend a hard allergen dish with a substitution (e.g. you CANNOT recommend Chicken Skewers to someone allergic to chicken!).
- Disqualify all dishes containing hard allergens immediately under "hardAllergenItems" with a score of 0.

DIETARY AVOID DIRECTIVE (MODIFIABLE):
- Identify items that conflict with avoid preferences (e.g., fried/deep-fried foods for cholesterol-conscious diners, beef/red meat). Flag them under "avoidItems".
- Substitutions are ONLY for avoid preferences (e.g. asking for grilled rather than fried, or olive oil instead of butter).

MULTI-OPTION RECOMMENDATION STRATEGY:
Provide 2 to 4 distinct safe options strictly free of all hard allergens:
- OPTION 1 (Best Ready As-Is): A dish naturally 100% compliant with ZERO modifications required (free of all hard allergens, respects avoids, matches taste preferences). Set optionType="ready_as_is", substitutionAdvice="".
- OPTION 2 & OPTION 3 (Safe Matches with Smart Cooking Substitutions): Dishes that are allergen-free and match flavor cravings, but benefit from a cooking style substitution (e.g. asking for grilled instead of fried, or sauce on the side).
  Set optionType="with_substitution".
  Provide a practical "substitutionAdvice" script for their server (e.g. "What to tell your server: 'Could the kitchen please prepare this grilled rather than fried, with sauce on the side?'").
- If the menu has no safe dishes, return an empty "topRecommendations" array.

TASTE & SCORING DIRECTIVE:
- Score safe dishes from 1 to 10 based on how well they match the diner's loved flavors (e.g. spicy, bold flavors, grilled over fried).
- Apply cross-cuisine analogs: if preferred cuisines are absent, find the closest flavor/texture analogs.
- For each recommended dish, provide a clear, personalized explanation in "whyItWorksForYou".

Return ONLY valid JSON matching this exact structure:
{
  "hardAllergenItems": ["Disqualified Allergen Dish 1"],
  "avoidItems": ["Avoid Dish 2"],
  "topRecommendedItems": ["Safe Dish 3", "Safe Dish 4"],
  "topRecommendations": [
    {
      "name": "Safe Dish 3",
      "score": 9.5,
      "optionType": "ready_as_is",
      "whyItWorksForYou": "Naturally 100% free of your allergens and delivers the bold spicy flavors you love without any frying.",
      "substitutionAdvice": "",
      "matchedPreferences": ["Spicy & Bold Heat", "Grilled over Fried", "Allergen Free"]
    }
  ],
  "items": [
    {
      "name": "Dish Name",
      "hasHardAllergen": false,
      "allergenDetails": [],
      "isAvoid": false,
      "avoidReason": "",
      "score": 8,
      "optionType": "ready_as_is",
      "substitutionAdvice": "",
      "whyItWorksForYou": "Why this works for the diner",
      "rationale": "Reasoning for allergen, avoid, and score"
    }
  ],
  "summaryNote": "High-level summary of risks and best choices"
}`;

  let menuSection = menuText;
  if (options?.restaurantContext) {
    menuSection = `Restaurant Information: ${options.restaurantContext}\n\n${menuText}`;
  }

  const userPrompt = `Diner Profile:
${JSON.stringify(profile, null, 2)}

Menu to scan:
${menuSection}`;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: {
        temperature: 0.1, // low temperature for deterministic safety checks
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.message?.content || "{}";

  try {
    const parsed = JSON.parse(rawContent) as Record<string, unknown>;
    const rawPicks = Array.isArray(parsed.topRecommendedItems) ? parsed.topRecommendedItems : [];
    const items = (Array.isArray(parsed.items) ? parsed.items : []) as MenuAnalysisResult["items"];

    // Defensively handle allergen and avoid lists (strings or objects)
    const hardAllergenItems = (Array.isArray(parsed.hardAllergenItems) ? parsed.hardAllergenItems : []).map(
      (item: unknown) => (typeof item === "string" ? item : String((item as Record<string, unknown>)?.name || (item as Record<string, unknown>)?.item || JSON.stringify(item)))
    );

    const avoidItems = (Array.isArray(parsed.avoidItems) ? parsed.avoidItems : []).map(
      (item: unknown) => (typeof item === "string" ? item : String((item as Record<string, unknown>)?.name || (item as Record<string, unknown>)?.item || JSON.stringify(item)))
    );

    // Build rich recommendations list
    let recommendations: RecommendedDish[] = [];

    if (parsed.topRecommendations && Array.isArray(parsed.topRecommendations) && parsed.topRecommendations.length > 0) {
      recommendations = (parsed.topRecommendations as Record<string, unknown>[]).map((rec, idx) => {
        const subAdvice = typeof rec.substitutionAdvice === "string" ? rec.substitutionAdvice.trim() : "";
        let optType: "ready_as_is" | "with_substitution" =
          rec.optionType === "with_substitution" || subAdvice.length > 0
            ? "with_substitution"
            : idx === 0
            ? "ready_as_is"
            : "ready_as_is";

        if (idx >= 1 && (subAdvice.length > 0 || String(rec.whyItWorksForYou || "").toLowerCase().includes("substitut") || String(rec.name || "").toLowerCase().includes("substitut"))) {
          optType = "with_substitution";
        }

        return {
          name: String(rec.name || "Recommended Dish"),
          score: typeof rec.score === "number" ? rec.score : Math.max(7, 9.5 - idx * 0.4),
          whyItWorksForYou: String(rec.whyItWorksForYou || "Safe from allergens and perfectly matched to your flavor preferences."),
          matchedPreferences: Array.isArray(rec.matchedPreferences) ? (rec.matchedPreferences as string[]) : ["Safe from allergens"],
          optionType: optType,
          substitutionAdvice: subAdvice || (optType === "with_substitution" ? "Ask your server if the kitchen can prepare this dish with olive oil and verify no hard allergens are used." : undefined),
        };
      });
    } else if (rawPicks.length > 0 && typeof rawPicks[0] === "object" && rawPicks[0] !== null) {
      // Model returned array of objects directly in topRecommendedItems
      recommendations = (rawPicks as Record<string, unknown>[]).map((item, idx) => {
        const subAdvice = typeof item.substitutionAdvice === "string" ? item.substitutionAdvice.trim() : "";
        const optType: "ready_as_is" | "with_substitution" =
          item.optionType === "with_substitution" || subAdvice.length > 0 || (idx >= 1 && subAdvice.length > 0)
            ? "with_substitution"
            : "ready_as_is";

        return {
          name: String(item.name || "Recommended Dish"),
          score: typeof item.score === "number" ? item.score : Math.max(7, 9.5 - idx * 0.4),
          whyItWorksForYou: String(item.whyItWorksForYou || item.rationale || "Safe from allergens and matched to your profile."),
          matchedPreferences: Array.isArray(item.matchedPreferences)
            ? (item.matchedPreferences as string[])
            : ["Safe from allergens", "Matches taste profile"],
          optionType: optType,
          substitutionAdvice: subAdvice || (optType === "with_substitution" ? "Ask server for a healthy oil/allergen-free substitution." : undefined),
        };
      });
    } else {
      // rawPicks is array of strings
      recommendations = (rawPicks as unknown[]).map((rawName, idx) => {
        const nameStr = typeof rawName === "string" ? rawName : String((rawName as Record<string, unknown>)?.name || "");
        const match = items?.find((i) => {
          const iName = typeof i?.name === "string" ? i.name.toLowerCase() : "";
          const target = nameStr.toLowerCase();
          if (!iName || !target) return false;
          return iName === target || iName.includes(target) || target.includes(iName);
        });

        const whyItWorks =
          match?.whyItWorksForYou ||
          match?.rationale ||
          "Safe from your hard allergens and aligned with your flavor preferences.";

        const matchedTags: string[] = [];
        if (!match?.hasHardAllergen) matchedTags.push("Allergen Safe");
        if (!match?.isAvoid) matchedTags.push("Constraint Friendly");

        const isSub = idx >= 1 && match?.isAvoid;
        const optType: "ready_as_is" | "with_substitution" = isSub ? "with_substitution" : "ready_as_is";

        let subAdvice: string | undefined = undefined;
        if (optType === "with_substitution") {
          subAdvice = "Ask your server: 'Could the kitchen prepare this grilled rather than fried, and use olive oil?'";
        }

        return {
          name: nameStr,
          score: match?.score || Math.max(7, 9.5 - idx * 0.5),
          whyItWorksForYou: whyItWorks,
          matchedPreferences: matchedTags.length > 0 ? matchedTags : ["Safe from allergens"],
          optionType: optType,
          substitutionAdvice: subAdvice,
        };
      });
    }

    // =========================================================================
    // DETERMINISTIC SAFETY ENFORCEMENT LAYER (ABSOLUTE 0-TOLERANCE)
    // Guarantee that NO dish containing or suspected of hard allergens is ever
    // recommended, even if Ollama made an error or hallucinated.
    // =========================================================================
    const confirmedHardAllergenSet = new Set<string>(
      hardAllergenItems.map((n) => n.trim().toLowerCase())
    );

    // 1. Audit all menu items
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || !item.name) continue;
        const check = checkHardAllergens(
          `${item.name} ${item.rationale || ""} ${item.whyItWorksForYou || ""}`,
          hardAllergens
        );
        if (check.hasAllergen) {
          item.hasHardAllergen = true;
          item.score = 0;
          confirmedHardAllergenSet.add(item.name.trim().toLowerCase());
        }
      }
    }

    // 2. Strict Hard Allergen Purge on Recommendations
    const safeRecommendations: RecommendedDish[] = [];
    for (const rec of recommendations) {
      const recNameLower = rec.name.trim().toLowerCase();
      const check = checkHardAllergens(
        `${rec.name} ${rec.whyItWorksForYou || ""} ${rec.substitutionAdvice || ""}`,
        hardAllergens
      );

      // Disqualify if check detects allergen or if rec.name was flagged as hard allergen
      const isFlagged =
        confirmedHardAllergenSet.has(recNameLower) ||
        Array.from(confirmedHardAllergenSet).some(
          (ha) => recNameLower === ha || (ha.length > 3 && (recNameLower.includes(ha) || ha.includes(recNameLower)))
        );

      if (check.hasAllergen || isFlagged) {
        confirmedHardAllergenSet.add(rec.name.trim());
        continue;
      }

      safeRecommendations.push(rec);
    }

    // 3. If recommendations were purged, backfill with safe dishes from items
    if (safeRecommendations.length < 2 && Array.isArray(items)) {
      const safeCandidates = items.filter((item) => {
        if (!item || !item.name) return false;
        if (item.hasHardAllergen) return false;
        const check = checkHardAllergens(
          `${item.name} ${item.rationale || ""} ${item.whyItWorksForYou || ""}`,
          hardAllergens
        );
        if (check.hasAllergen) return false;
        const nameLower = item.name.trim().toLowerCase();
        if (confirmedHardAllergenSet.has(nameLower)) return false;
        if (safeRecommendations.some((r) => r.name.toLowerCase() === nameLower)) return false;
        return true;
      });

      safeCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));

      for (const candidate of safeCandidates) {
        if (safeRecommendations.length >= 3) break;
        const optType = candidate.isAvoid ? "with_substitution" : "ready_as_is";
        safeRecommendations.push({
          name: candidate.name,
          score: candidate.score || 8,
          whyItWorksForYou: candidate.whyItWorksForYou || "Verified 100% free of your hard allergens.",
          matchedPreferences: ["100% Allergen Safe"],
          optionType: optType,
          substitutionAdvice: candidate.isAvoid
            ? "Ask your server: 'Could the kitchen prepare this grilled rather than fried, and use olive oil?'"
            : undefined,
        });
      }
    }

    // 4. Update final list
    const finalHardAllergens = Array.from(
      new Set([
        ...hardAllergenItems,
        ...Array.from(confirmedHardAllergenSet),
      ])
    ).filter(Boolean);

    let summaryNote = typeof parsed.summaryNote === "string" ? parsed.summaryNote : undefined;
    if (safeRecommendations.length === 0) {
      summaryNote = `⚠️ ALLERGEN WARNING: No safe dishes could be found on this menu. All scanned dishes contain or risk cross-contamination with your hard allergens (${hardAllergens.join(", ")}).`;
    }

    const dishNames = safeRecommendations.map((r) => r.name);

    return {
      hardAllergenItems: finalHardAllergens,
      avoidItems,
      topRecommendedItems: dishNames,
      topRecommendations: safeRecommendations,
      items,
      summaryNote,
    };
  } catch (err) {
    throw new Error(
      `Failed to parse Ollama JSON response: ${err instanceof Error ? err.message : String(err)}. Raw output: ${rawContent}`
    );
  }
}
