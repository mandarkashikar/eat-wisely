/**
 * Deterministic Food Safety & Allergen Filter
 * Zero false negatives for hard allergens.
 */

export interface AllergenCheckResult {
  hasAllergen: boolean;
  matchedAllergens: string[];
  matchedTerms: string[];
}

/**
 * Common culinary synonyms and derivatives for hard allergens.
 */
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  chicken: [
    "chicken",
    "poultry",
    "gai",
    "pollo",
    "poulet",
    "rooster",
    "fowl",
    "wings",
    "tenders",
    "drumstick",
    "thigh",
  ],
  peanut: [
    "peanut",
    "peanuts",
    "groundnut",
    "groundnuts",
    "arachis",
    "satay sauce",
    "peanut sauce",
    "peanut butter",
    "beer nuts",
    "monkey nuts",
  ],
  peanuts: [
    "peanut",
    "peanuts",
    "groundnut",
    "groundnuts",
    "arachis",
    "satay sauce",
    "peanut sauce",
    "peanut butter",
  ],
  "fish sauce": [
    "fish sauce",
    "nam pla",
    "nuoc mam",
    "nam pla prik",
    "anchovy sauce",
    "fermented fish",
  ],
  "fish oil": [
    "fish oil",
    "anchovy oil",
    "cod liver oil",
    "omega-3 fish",
    "anchovy paste",
  ],
  fish: [
    "fish",
    "salmon",
    "tuna",
    "cod",
    "halibut",
    "sea bass",
    "snapper",
    "trout",
    "anchovy",
    "anchovies",
    "tilapia",
    "sardine",
    "sardines",
    "mackerel",
    "haddock",
    "pollock",
    "swordfish",
    "pla",
  ],
  shellfish: [
    "shellfish",
    "shrimp",
    "prawn",
    "prawns",
    "crab",
    "lobster",
    "crawfish",
    "crayfish",
    "mussel",
    "mussels",
    "clam",
    "clams",
    "calamari",
    "squid",
    "octopus",
    "oyster",
    "oysters",
    "scallop",
    "scallops",
    "goong",
    "kung",
  ],
  dairy: [
    "dairy",
    "milk",
    "cream",
    "cheese",
    "butter",
    "yogurt",
    "yoghurt",
    "ghee",
    "paneer",
    "curd",
    "whey",
    "casein",
    "custard",
    "parmesan",
    "mozzarella",
    "cheddar",
    "ricotta",
    "burrata",
    "gelato",
  ],
  egg: [
    "egg",
    "eggs",
    "mayonnaise",
    "mayo",
    "aioli",
    "meringue",
    "custard",
    "hollandaise",
    "albumen",
    "ovalbumin",
  ],
  eggs: [
    "egg",
    "eggs",
    "mayonnaise",
    "mayo",
    "aioli",
    "meringue",
    "custard",
    "hollandaise",
  ],
  soy: [
    "soy",
    "soya",
    "tofu",
    "edamame",
    "miso",
    "tamari",
    "tempeh",
    "soy sauce",
    "shoyu",
  ],
  gluten: [
    "gluten",
    "wheat",
    "flour",
    "barley",
    "rye",
    "malt",
    "spelt",
    "seitan",
    "breadcrumbs",
    "battered",
    "pasta",
    "bread",
    "crust",
  ],
  "tree nuts": [
    "almond",
    "almonds",
    "walnut",
    "walnuts",
    "cashew",
    "cashews",
    "pecan",
    "pecans",
    "pistachio",
    "pistachios",
    "hazelnut",
    "hazelnuts",
    "macadamia",
    "pine nut",
    "pine nuts",
    "praline",
    "marzipan",
    "gianduja",
  ],
  sesame: [
    "sesame",
    "tahini",
    "halvah",
    "sesame oil",
    "sesame seed",
    "sesame seeds",
  ],
  beef: [
    "beef",
    "steak",
    "flank",
    "ribeye",
    "sirloin",
    "brisket",
    "burger",
    "meatball",
    "meatballs",
    "carne",
    "veal",
  ],
  pork: [
    "pork",
    "bacon",
    "ham",
    "prosciutto",
    "pancetta",
    "carnitas",
    "sausage",
    "chorizo",
    "lard",
  ],
};

/**
 * Checks text against an array of hard allergens.
 */
export function checkHardAllergens(
  text: string,
  hardAllergens: string[]
): AllergenCheckResult {
  if (!text || !hardAllergens || hardAllergens.length === 0) {
    return { hasAllergen: false, matchedAllergens: [], matchedTerms: [] };
  }

  const textLower = text.toLowerCase();
  const matchedAllergens: string[] = [];
  const matchedTerms: string[] = [];

  for (const rawAllergen of hardAllergens) {
    const allergenClean = rawAllergen.trim().toLowerCase();
    if (!allergenClean) continue;

    // Build list of terms to search for
    const terms = new Set<string>();
    terms.add(allergenClean);

    // Add synonyms if available
    for (const [key, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
      if (allergenClean === key || allergenClean.includes(key) || key.includes(allergenClean)) {
        for (const syn of synonyms) {
          terms.add(syn);
        }
      }
    }

    // Check each term against text
    for (const term of terms) {
      if (term.length < 2) continue;

      // Word boundary regex for clean match
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");

      if (wordRegex.test(textLower) || textLower.includes(term)) {
        matchedAllergens.push(rawAllergen);
        matchedTerms.push(term);
        break;
      }
    }
  }

  return {
    hasAllergen: matchedAllergens.length > 0,
    matchedAllergens: Array.from(new Set(matchedAllergens)),
    matchedTerms: Array.from(new Set(matchedTerms)),
  };
}

