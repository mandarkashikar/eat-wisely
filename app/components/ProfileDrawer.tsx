"use client";

import { useState, useEffect } from "react";
import { UserProfile } from "@/lib/types";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
  onReset: () => void;
  hasActiveMenu?: boolean;
}

const COMMON_ALLERGENS = ["Fish Oil", "Fish Sauce", "Peanuts", "Tree Nuts", "Shellfish", "Dairy", "Gluten", "Soy", "Eggs"];
const COMMON_AVOIDS = ["Fried foods", "High cholesterol", "Red meat", "Excessive sodium", "High sugar"];
const COMMON_LOVES = ["Indian food", "Spicy food", "Dark chocolate gelato", "Thai food", "Mexican food", "Grilled / Roasted", "Bold garlic & herbs"];

export default function ProfileDrawer({
  isOpen,
  onClose,
  profile,
  onSave,
  onReset,
  hasActiveMenu = false,
}: ProfileDrawerProps) {
  const [localProfile, setLocalProfile] = useState<UserProfile>(profile);
  const [newAllergen, setNewAllergen] = useState("");
  const [newAvoid, setNewAvoid] = useState("");
  const [newLoves, setNewLoves] = useState("");
  const [hintsText, setHintsText] = useState(() =>
    (profile.crossCuisinePreferenceHints || []).join("\n")
  );

  useEffect(() => {
    setLocalProfile(profile);
    setHintsText((profile.crossCuisinePreferenceHints || []).join("\n"));
  }, [profile, isOpen]);

  if (!isOpen) return null;

  // Hard Allergen Handlers
  function removeAllergen(item: string) {
    const updated = (localProfile.dietaryConstraints?.hardAllergens || []).filter(
      (a) => a.toLowerCase() !== item.toLowerCase()
    );
    setLocalProfile({
      ...localProfile,
      dietaryConstraints: {
        ...localProfile.dietaryConstraints,
        hardAllergens: updated,
      },
    });
  }

  function addAllergen(item: string) {
    const val = item.trim();
    if (!val) return;
    const current = localProfile.dietaryConstraints?.hardAllergens || [];
    if (!current.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setLocalProfile({
        ...localProfile,
        dietaryConstraints: {
          ...localProfile.dietaryConstraints,
          hardAllergens: [...current, val],
        },
      });
    }
    setNewAllergen("");
  }

  // Avoid Handlers
  function removeAvoid(item: string) {
    const updated = (localProfile.allergensAndAvoids || []).filter(
      (a) => a.toLowerCase() !== item.toLowerCase()
    );
    setLocalProfile({
      ...localProfile,
      allergensAndAvoids: updated,
    });
  }

  function addAvoid(item: string) {
    const val = item.trim();
    if (!val) return;
    const current = localProfile.allergensAndAvoids || [];
    if (!current.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setLocalProfile({
        ...localProfile,
        allergensAndAvoids: [...current, val],
      });
    }
    setNewAvoid("");
  }

  // Loves Handlers
  function removeLove(item: string) {
    const updated = (localProfile.loves || []).filter(
      (l) => l.toLowerCase() !== item.toLowerCase()
    );
    setLocalProfile({
      ...localProfile,
      loves: updated,
    });
  }

  function addLove(item: string) {
    const val = item.trim();
    if (!val) return;
    const current = localProfile.loves || [];
    if (!current.some((l) => l.toLowerCase() === val.toLowerCase())) {
      setLocalProfile({
        ...localProfile,
        loves: [...current, val],
      });
    }
    setNewLoves("");
  }

  function handleSave() {
    const hints = hintsText
      .split("\n")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    const updatedProfile: UserProfile = {
      ...localProfile,
      crossCuisinePreferenceHints: hints,
    };

    onSave(updatedProfile);
    onClose();
  }

  const hardAllergens = localProfile.dietaryConstraints?.hardAllergens || [];
  const avoids = localProfile.allergensAndAvoids || [];
  const loves = localProfile.loves || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-fade-in">
          {/* Header */}
          <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-950 flex items-center gap-2">
                <span>⚙️</span> Preferences &amp; Allergies
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Customizes your safety filters &amp; recommendation scoring.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition text-sm"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
            {/* 1. Hard Allergens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  ⛔ Hard Allergens (0-Tolerance)
                </label>
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-medium">
                  Never Recommended
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Any dish containing or suspected of using these will be disqualified and flagged.
              </p>

              {/* Active Allergens Tags */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {hardAllergens.length > 0 ? (
                  hardAllergens.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 text-xs px-2.5 py-1 rounded-md font-medium"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeAllergen(item)}
                        className="text-rose-500 hover:text-rose-900 font-bold ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400 italic">No hard allergens set.</span>
                )}
              </div>

              {/* Add Custom Allergen */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newAllergen}
                  onChange={(e) => setNewAllergen(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAllergen(newAllergen);
                    }
                  }}
                  placeholder="Type an allergen (e.g. Peanuts, Shellfish)…"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => addAllergen(newAllergen)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
                >
                  + Add
                </button>
              </div>

              {/* Quick suggestions */}
              <div className="pt-1">
                <span className="text-[11px] text-neutral-400 block mb-1">Quick add:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_ALLERGENS.filter((a) => !hardAllergens.some((ha) => ha.toLowerCase() === a.toLowerCase())).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => addAllergen(item)}
                      className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded transition"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Dietary Avoids */}
            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  ⚠️ Dietary Avoids
                </label>
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  Score Penalized
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Ingredients or styles to avoid (e.g. fried food for cholesterol, high sodium).
              </p>

              {/* Active Avoids Tags */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {avoids.length > 0 ? (
                  avoids.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-md font-medium"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeAvoid(item)}
                        className="text-amber-500 hover:text-amber-900 font-bold ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400 italic">No avoids set.</span>
                )}
              </div>

              {/* Add Custom Avoid */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newAvoid}
                  onChange={(e) => setNewAvoid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAvoid(newAvoid);
                    }
                  }}
                  placeholder="Type an avoid (e.g. Fried foods, Red meat)…"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => addAvoid(newAvoid)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
                >
                  + Add
                </button>
              </div>

              {/* Quick suggestions */}
              <div className="pt-1">
                <span className="text-[11px] text-neutral-400 block mb-1">Quick add:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_AVOIDS.filter((a) => !avoids.some((av) => av.toLowerCase().includes(a.toLowerCase()))).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => addAvoid(item)}
                      className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded transition"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Loves & Taste Preferences */}
            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  ⭐ Loved Flavors &amp; Cuisines
                </label>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                  Boosted in Ranking
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Dishes matching these flavors and preparations will score highest.
              </p>

              {/* Active Loves Tags */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {loves.length > 0 ? (
                  loves.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-md font-medium"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeLove(item)}
                        className="text-emerald-500 hover:text-emerald-900 font-bold ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400 italic">No preferences set.</span>
                )}
              </div>

              {/* Add Custom Love */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newLoves}
                  onChange={(e) => setNewLoves(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLove(newLoves);
                    }
                  }}
                  placeholder="Type a favorite flavor (e.g. Spicy, Garlic, BBQ)…"
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => addLove(newLoves)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
                >
                  + Add
                </button>
              </div>

              {/* Quick suggestions */}
              <div className="pt-1">
                <span className="text-[11px] text-neutral-400 block mb-1">Quick add:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_LOVES.filter((l) => !loves.some((cur) => cur.toLowerCase().includes(l.toLowerCase()))).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => addLove(item)}
                      className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded transition"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Cross-Cuisine Matching Hints */}
            <div className="space-y-2 pt-4 border-t border-neutral-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                💡 Cross-Cuisine Matching Rules
              </label>
              <p className="text-xs text-neutral-500">
                One rule per line. Guides the AI on how to map your preferences when specific cuisines are missing.
              </p>
              <textarea
                rows={3}
                value={hintsText}
                onChange={(e) => setHintsText(e.target.value)}
                placeholder="e.g. If no Indian food, look for other spicy/bold-flavor dishes as the closest match"
                className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs focus:border-neutral-900 focus:outline-hidden bg-neutral-50/50"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4"
            >
              Reset to Defaults
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition shadow-xs flex items-center gap-1.5"
              >
                <span>{hasActiveMenu ? "Save & Re-run Recommendations →" : "Save & Apply"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
