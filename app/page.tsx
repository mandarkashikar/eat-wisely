"use client";

import { useState, useEffect, useRef, DragEvent, ChangeEvent } from "react";
import { MenuAnalysisResult, UserProfile, RecommendedDish } from "@/lib/types";
import { checkHardAllergens } from "@/lib/safety";
import ProfileDrawer from "./components/ProfileDrawer";

const DEFAULT_PROFILE: UserProfile = {
  name: "Mandar",
  note: "Customized diner profile",
  allergensAndAvoids: [
    "fried foods (cholesterol-conscious, not an allergy — avoid, don't hard-block)",
  ],
  loves: [
    "Indian food",
    "spicy food",
    "dark chocolate gelato (gianduja, black sesame flavors especially)",
  ],
  dietaryConstraints: {
    cholesterolConscious: true,
    hardAllergens: ["fish oil"],
  },
  crossCuisinePreferenceHints: [
    "If no Indian food on the menu, look for other spicy/bold-flavor dishes as the closest match",
    "Prefer grilled/roasted over fried when scoring equivalent dishes",
  ],
};

const SAMPLE_MENUS = [
  {
    label: "🍜 Thai Bistro",
    text: `1. Pad Thai - Rice noodles stir-fried with tofu, bean sprouts, crushed peanuts, egg, and tamarind fish sauce.
2. Crispy Spring Rolls - Deep-fried rolls stuffed with cabbage, carrots, and glass noodles, served with sweet chili dip.
3. Grilled Chicken Satay - Skewered marinated chicken breast grilled over flame, served with spicy peanut sauce and cucumber relish.
4. Tom Yum Goong - Hot and sour lemongrass broth with shrimp, mushrooms, chili, lime leaves, and a dash of fish oil.
5. Green Curry Chicken - Fiery spicy coconut milk curry with bamboo shoots, Thai basil, and chicken breast.`,
  },
  {
    label: "🍝 Italian Trattoria",
    text: `1. Calamari Fritti - Tender squid rings, lightly battered and flash-fried crispy, served with garlic aioli.
2. Penne all'Arrabbiata - Penne pasta tossed in a fiery, spicy crushed red pepper and garlic San Marzano tomato sauce.
3. Pollo alla Griglia - Herb-marinated chicken breast grilled to perfection, served with roasted vegetables.
4. Fritto Misto - Assorted fried seafood and seasonal vegetables.
5. Artisanal Gelato Trio - Handcrafted scoop featuring dark chocolate gianduja, pistachio, and vanilla bean.`,
  },
  {
    label: "🌮 Cantina Mexicana",
    text: `1. Taquitos Dorados - Crispy deep-fried rolled corn tortillas filled with shredded chicken.
2. Carne Asada Platter - Flame-grilled flank steak marinated in citrus and spices, served with charred jalapeño salsa and warm corn tortillas.
3. Chimichanga Especial - Deep-fried flour tortilla stuffed with beef, melted cheese, and refried beans.
4. Pollo Al Pastor Bowl - Grilled achiote-spiced chicken, spicy habanero salsa, black beans, and cilantro rice.
5. Caesar Salad con Anchoas - Classic crisp romaine tossed with traditional Caesar dressing made with anchovy paste and fish oil.`,
  },
];

type InputMode = "file" | "link" | "text";

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem("eat_wisely_profile");
      if (saved) {
        setProfile(JSON.parse(saved));
      }
    } catch {}
  }, []);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>("file");
  const [menuText, setMenuText] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Scanning your menu…");
  const [result, setResult] = useState<MenuAnalysisResult | null>(null);
  const [activeMenuSource, setActiveMenuSource] = useState<{ text?: string; url?: string } | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number>(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function copyToClipboard(text: string) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2500);
    } catch {}
  }

  function handleSaveProfile(updated: UserProfile) {
    setProfile(updated);
    try {
      localStorage.setItem("eat_wisely_profile", JSON.stringify(updated));
    } catch {}

    // If a menu has been analyzed or input is present, immediately re-run recommendations!
    const effectiveText = activeMenuSource?.text || menuText;
    const effectiveUrl = activeMenuSource?.url || menuUrl;
    if (result || effectiveText.trim() || effectiveUrl.trim()) {
      handleAnalyze({
        textOverride: effectiveText,
        urlOverride: effectiveUrl,
        profileOverride: updated,
      });
    }
  }

  function handleResetProfile() {
    setProfile(DEFAULT_PROFILE);
    try {
      localStorage.removeItem("eat_wisely_profile");
    } catch {}

    const effectiveText = activeMenuSource?.text || menuText;
    const effectiveUrl = activeMenuSource?.url || menuUrl;
    if (result || effectiveText.trim() || effectiveUrl.trim()) {
      handleAnalyze({
        textOverride: effectiveText,
        urlOverride: effectiveUrl,
        profileOverride: DEFAULT_PROFILE,
      });
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  }
  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  }
  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setMenuText((evt.target?.result as string) || "");
    };
    reader.readAsText(file);
  }

  async function handleAnalyze(options?: {
    textOverride?: string;
    urlOverride?: string;
    profileOverride?: UserProfile;
  }) {
    const text = options?.textOverride !== undefined ? options.textOverride : (activeMenuSource?.text ?? menuText);
    const url = options?.urlOverride !== undefined ? options.urlOverride : (activeMenuSource?.url ?? menuUrl);
    const targetProfile = options?.profileOverride || profile;

    if (!url.trim() && !text.trim()) {
      setError("Please provide a file, website link, or paste menu text.");
      return;
    }

    setLoading(true);
    setLoadingMessage(
      options?.profileOverride
        ? "Re-evaluating recommendations with your updated preferences…"
        : url.trim()
        ? "Fetching website & extracting menu…"
        : "Scanning your menu with Llama 3.2…"
    );
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuText: text.trim() || undefined,
          url: url.trim() || undefined,
          profile: targetProfile,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");

      setResult(data.result);
      setActiveMenuSource({ text, url });
      setSelectedOptionIdx(0);
      setCopiedText(null);
      if (data.sourceTitle) {
        setSourceTitle(data.sourceTitle);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setMenuText("");
    setMenuUrl("");
    setFileName(null);
    setSourceTitle(null);
    setResult(null);
    setActiveMenuSource(null);
    setSelectedOptionIdx(0);
    setCopiedText(null);
    setError(null);
  }

  const hardAllergens = (profile.dietaryConstraints?.hardAllergens || []).map((a) => a.trim()).filter(Boolean);

  // Build the raw recommendation list from result with option types and substitutions
  const rawPicks: RecommendedDish[] =
    result?.topRecommendations && result.topRecommendations.length > 0
      ? result.topRecommendations.map((rec, idx) => {
          const sub = rec.substitutionAdvice?.trim();
          const optType =
            rec.optionType ||
            (sub ? "with_substitution" : idx === 0 ? "ready_as_is" : "ready_as_is");
          return {
            ...rec,
            optionType: optType,
            substitutionAdvice: sub,
          };
        })
      : (result?.topRecommendedItems || []).map((rawName: unknown, idx) => {
          const name =
            typeof rawName === "string"
              ? rawName
              : String((rawName as Record<string, unknown>)?.name || "Recommended Dish");
          const detail = result?.items?.find((i) => {
            const iName = typeof i?.name === "string" ? i.name.toLowerCase() : "";
            const target = name.toLowerCase();
            if (!iName || !target) return false;
            return iName === target || iName.includes(target) || target.includes(iName);
          });

          const isSub = idx >= 1 && detail?.isAvoid;
          return {
            name,
            score: detail?.score || Math.max(7, 9.5 - idx * 0.4),
            optionType: isSub ? "with_substitution" : "ready_as_is",
            substitutionAdvice:
              detail?.substitutionAdvice ||
              (isSub
                ? "Ask your server: 'Could the kitchen prepare this grilled rather than fried, and use olive oil?'"
                : undefined),
            whyItWorksForYou:
              detail?.whyItWorksForYou ||
              detail?.rationale ||
              "Safe from your hard allergens and aligned with your flavor preferences.",
            matchedPreferences: detail?.matchedPreferences || ["Safe from allergens"],
          };
        });

  // CRITICAL CLIENT-SIDE GUARDRAIL: Zero tolerance for hard allergens.
  // Purge any recommendation that contains or mentions a hard allergen!
  const picks: RecommendedDish[] = rawPicks.filter((dish) => {
    const allergenCheck = checkHardAllergens(
      `${dish.name} ${dish.whyItWorksForYou || ""} ${dish.substitutionAdvice || ""}`,
      hardAllergens
    );
    const isInDangers = (result?.hardAllergenItems || []).some((d) => {
      const dClean = d.toLowerCase().trim();
      const nClean = dish.name.toLowerCase().trim();
      return dClean === nClean || (dClean.length > 3 && nClean.includes(dClean));
    });
    return !allergenCheck.hasAllergen && !isInDangers;
  });

  const dangers = Array.from(
    new Set([
      ...(result?.hardAllergenItems || []),
      ...rawPicks
        .filter((dish) => !picks.includes(dish))
        .map((dish) => dish.name),
    ])
  );
  const avoids = result?.avoidItems || [];

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
      {/* ── PROFILE SIDE PANEL DRAWER ── */}
      <ProfileDrawer
        key={isProfileOpen ? "open" : "closed"}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
        onReset={handleResetProfile}
        hasActiveMenu={Boolean(result || activeMenuSource || menuText.trim() || menuUrl.trim())}
      />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        <div className="mx-auto max-w-2xl px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <span className="font-semibold text-base tracking-tight text-neutral-950">
              Eat Wisely
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition"
              title="Adjust allergies and taste preferences"
            >
              <span>⚙️</span>
              <span>Preferences</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>
            {(result || loading) && (
              <button
                onClick={resetAll}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition ml-1"
              >
                ← New menu
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* ================= STEP 1: UPLOAD SCREEN ================= */}
        {!result && !loading && (
          <div className="animate-fade-in space-y-6">
            {/* Headline */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-neutral-950">
                What should you eat?
              </h1>
              <p className="text-neutral-500 text-sm max-w-md mx-auto">
                Upload a menu file or paste a link from a restaurant website or Google Maps.
              </p>
            </div>

            {/* Active Preference Banner */}
            <div
              suppressHydrationWarning
              className="flex items-center justify-between bg-neutral-50/90 rounded-xl px-4 py-2.5 border border-neutral-200 text-xs text-neutral-600"
            >
              <div className="flex items-center gap-2 overflow-hidden" suppressHydrationWarning>
                <span className="font-semibold text-neutral-900">Personalized for:</span>
                <span className="text-rose-600 font-medium truncate" suppressHydrationWarning>
                  No {profile.dietaryConstraints?.hardAllergens?.join(", ") || "allergens"}
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-medium truncate" suppressHydrationWarning>
                  Loves {profile.loves?.slice(0, 2).join(", ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="text-neutral-900 font-semibold underline hover:text-black ml-2 whitespace-nowrap"
              >
                Adjust →
              </button>
            </div>

            {/* Input Mode Selector */}
            <div className="flex justify-center border-b border-neutral-100 pb-2">
              <div className="inline-flex rounded-full bg-neutral-100 p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMode("file")}
                  className={`px-4 py-1.5 rounded-full transition ${
                    mode === "file"
                      ? "bg-white text-neutral-950 shadow-xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  📄 File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setMode("link")}
                  className={`px-4 py-1.5 rounded-full transition ${
                    mode === "link"
                      ? "bg-white text-neutral-950 shadow-xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  🔗 Website / Maps Link
                </button>
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={`px-4 py-1.5 rounded-full transition ${
                    mode === "text"
                      ? "bg-white text-neutral-950 shadow-xs font-semibold"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  📋 Paste Text
                </button>
              </div>
            </div>

            {/* MODE 1: FILE DROPZONE */}
            {mode === "file" && (
              <div className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition ${
                    isDragging
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.json"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <p className="text-3xl mb-2">📁</p>
                  {fileName ? (
                    <p className="font-semibold text-emerald-700 text-sm">
                      Selected: {fileName}
                    </p>
                  ) : (
                    <p className="font-medium text-neutral-700 text-sm">
                      Drop menu file here or <span className="underline">browse</span>
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    Accepts text files (.txt, .md, .csv)
                  </p>
                </div>

                {fileName && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => handleAnalyze()}
                      className="rounded-full bg-neutral-900 text-white px-8 py-3 text-sm font-semibold hover:bg-neutral-800 transition shadow-xs"
                    >
                      Get Recommendations →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: WEBSITE OR GOOGLE MAPS LINK */}
            {mode === "link" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 p-6 space-y-4 bg-neutral-50/50">
                  <div className="space-y-1">
                    <label
                      htmlFor="menuUrl"
                      className="block text-xs font-semibold uppercase tracking-wider text-neutral-600"
                    >
                      Restaurant Website or Google Maps Link
                    </label>
                    <p className="text-xs text-neutral-400">
                      We&apos;ll automatically pull and parse the menu for you.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="menuUrl"
                      type="url"
                      value={menuUrl}
                      onChange={(e) => setMenuUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAnalyze();
                      }}
                      placeholder="https://maps.app.goo.gl/... or https://restaurant.com/menu"
                      className="flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:border-neutral-900 focus:outline-hidden bg-white"
                    />
                    <button
                      onClick={() => handleAnalyze()}
                      disabled={!menuUrl.trim()}
                      className="rounded-xl bg-neutral-900 text-white px-6 py-2.5 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-40 transition whitespace-nowrap"
                    >
                      Fetch &amp; Recommend →
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>Try example link:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const exUrl = "https://www.google.com/maps/place/Pai+Northern+Thai+Kitchen/@43.6478954,-79.3887221,17z";
                        setMenuUrl(exUrl);
                        handleAnalyze({ urlOverride: exUrl });
                      }}
                      className="underline hover:text-neutral-900 transition"
                    >
                      Pai Northern Thai (Google Maps)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODE 3: RAW TEXT PASTE */}
            {mode === "text" && (
              <div className="space-y-3">
                <textarea
                  rows={7}
                  value={menuText}
                  onChange={(e) => setMenuText(e.target.value)}
                  placeholder="Paste dishes and descriptions here…"
                  className="w-full rounded-xl border border-neutral-200 p-4 text-sm focus:border-neutral-900 focus:outline-hidden resize-none bg-white shadow-xs"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleAnalyze()}
                    disabled={!menuText.trim()}
                    className="rounded-full bg-neutral-900 text-white px-6 py-2.5 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-40 transition"
                  >
                    Analyze Menu →
                  </button>
                </div>
              </div>
            )}

            {/* Quick Sample Presets */}
            <div className="border-t border-neutral-100 pt-6 text-center">
              <p className="text-xs text-neutral-400 mb-3">
                Or try a sample menu in 1 click
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_MENUS.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => {
                      setMenuText(m.text);
                      setMenuUrl("");
                      setFileName(`${m.label}.txt`);
                      handleAnalyze({ textOverride: m.text });
                    }}
                    className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-medium hover:bg-neutral-50 hover:border-neutral-400 transition"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 text-center bg-red-50 p-3 rounded-lg border border-red-200">
                {error}
              </p>
            )}
          </div>
        )}

        {/* ════════════════ LOADING ════════════════ */}
        {loading && (
          <div className="py-28 text-center animate-fade-in space-y-4">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin-slow" />
            <div className="space-y-1">
              <p className="font-semibold text-lg text-neutral-900">
                {loadingMessage}
              </p>
              <p className="text-xs text-neutral-400">
                Filtering allergens &amp; scoring with your taste profile
              </p>
            </div>
          </div>
        )}

        {/* ════════════════ RESULTS ════════════════ */}
        {result && !loading && (
          <div className="animate-fade-in space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  Allergen Checked • Multi-Option Selector
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-neutral-950 mt-3">
                  Your Curated Options
                </h2>
                <p className="text-neutral-500 text-sm mt-1">
                  {sourceTitle ? `From ${sourceTitle} • ` : ""}
                  Option 1 is safe as-is; subsequent options feature easy kitchen substitutions.
                </p>
              </div>

              <button
                onClick={() => setIsProfileOpen(true)}
                className="self-start sm:self-auto text-xs font-medium text-neutral-600 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-lg transition"
              >
                ⚙️ Adjust Profile &amp; Re-run
              </button>
            </div>

            {/* Selected Option Highlight & Server Script Bar */}
            {picks.length > 0 && picks[selectedOptionIdx] && (
              <div className="rounded-2xl bg-neutral-900 text-white p-5 shadow-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Your Selected Choice (Option {selectedOptionIdx + 1})
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">
                      {picks[selectedOptionIdx].name}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border self-start sm:self-auto ${
                      picks[selectedOptionIdx].optionType === "with_substitution"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {picks[selectedOptionIdx].optionType === "with_substitution"
                      ? "🔄 Kitchen Customization"
                      : "✨ 100% Ready As-Is"}
                  </span>
                </div>

                {picks[selectedOptionIdx].substitutionAdvice ? (
                  <div className="rounded-xl bg-white/10 p-3.5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <span>🗣️</span> Tell Your Server:
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(picks[selectedOptionIdx].substitutionAdvice || "")}
                        className="text-xs font-bold text-neutral-900 bg-white hover:bg-neutral-100 px-3 py-1 rounded-full transition shadow-xs"
                      >
                        {copiedText === picks[selectedOptionIdx].substitutionAdvice ? "✓ Copied!" : "📋 Copy Request"}
                      </button>
                    </div>
                    <p className="text-sm text-neutral-100 font-medium italic">
                      &ldquo;{picks[selectedOptionIdx].substitutionAdvice}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 rounded-xl px-3.5 py-2.5 border border-emerald-500/20">
                    <span className="font-bold">✓</span>
                    <span>No substitutions needed. This dish can be ordered straight off the menu!</span>
                  </div>
                )}
              </div>
            )}

            {/* Recommendation cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500 px-1">
                <span>Select from {picks.length} options below:</span>
                <span className="text-[11px] font-normal text-neutral-400">Click card to select</span>
              </div>

              {picks.length > 0 ? (
                <div className="space-y-4">
                  {picks.map((dish, idx) => {
                    const isSelected = selectedOptionIdx === idx;
                    const isReady = dish.optionType !== "with_substitution" && !dish.substitutionAdvice;
                    const optNumber = idx + 1;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedOptionIdx(idx)}
                        className={`rounded-2xl border transition-all cursor-pointer p-6 space-y-4 text-left relative ${
                          isSelected
                            ? "border-neutral-900 bg-neutral-50/50 shadow-md ring-2 ring-neutral-900/10"
                            : "border-neutral-200 bg-white hover:border-neutral-300 shadow-xs"
                        }`}
                      >
                        {/* Header: Option Tag + Score + Selection Radio */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                isReady
                                  ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100/80 text-amber-900 border border-amber-200"
                              }`}
                            >
                              <span>
                                {isReady
                                  ? `✨ Option ${optNumber}: Ready As-Is`
                                  : `🔄 Option ${optNumber}: With Substitution`}
                              </span>
                            </span>
                            {dish.score && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-800">
                                ★ {dish.score}/10
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOptionIdx(idx);
                            }}
                            className={`text-xs font-semibold px-3 py-1 rounded-full border transition shrink-0 ${
                              isSelected
                                ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                                : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-900"
                            }`}
                          >
                            {isSelected ? "✓ Selected Choice" : "Select Option"}
                          </button>
                        </div>

                        {/* Dish Title */}
                        <div>
                          <h3 className="font-bold text-xl text-neutral-950 leading-snug">
                            {dish.name}
                          </h3>
                        </div>

                        {/* Recommended Kitchen Substitution Callout (if applicable) */}
                        {!isReady && dish.substitutionAdvice && (
                          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200/90 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                <span>🗣️</span> Recommended Kitchen Request
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(dish.substitutionAdvice || "");
                                }}
                                className="text-[11px] font-semibold text-amber-950 bg-amber-200/70 hover:bg-amber-200 px-2.5 py-1 rounded-md transition"
                              >
                                {copiedText === dish.substitutionAdvice ? "✓ Copied!" : "📋 Copy to Show Server"}
                              </button>
                            </div>
                            <p className="text-sm text-amber-950 font-medium leading-relaxed italic">
                              &ldquo;{dish.substitutionAdvice}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Dedicated "Why this works for you" callout */}
                        <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                              <span>💡</span> Why this option works for you
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                              {isReady ? "✓ 100% Safe As-Is" : "✓ Safe with Kitchen Request"}
                            </span>
                          </div>
                          <p className="text-sm text-emerald-950 leading-relaxed font-normal">
                            {dish.whyItWorksForYou}
                          </p>
                        </div>

                        {/* Matched preference tags */}
                        {dish.matchedPreferences && dish.matchedPreferences.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[11px] text-neutral-400 font-medium mr-1">Matches:</span>
                            {dish.matchedPreferences.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto text-xl font-bold">
                    ⚠️
                  </div>
                  <h3 className="font-bold text-lg text-rose-950">
                    No Safe Dishes Found for Your Allergies
                  </h3>
                  <p className="text-sm text-rose-800 max-w-md mx-auto">
                    All scanned dishes from this menu contain or risk cross-contamination with your hard allergens ({hardAllergens.join(", ")}). For your safety, zero dishes were recommended.
                  </p>
                </div>
              )}
            </div>

            {/* Filtered‐out section */}
            {(dangers.length > 0 || avoids.length > 0) && (
              <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-5 text-sm space-y-3">
                <p className="font-semibold text-neutral-600 text-xs uppercase tracking-wide">
                  Filtered out
                </p>
                {dangers.length > 0 && (
                  <p className="text-xs text-neutral-700">
                    <span className="text-red-600 font-semibold">
                      ⛔ Allergen risk:
                    </span>{" "}
                    {dangers.join(", ")}
                  </p>
                )}
                {avoids.length > 0 && (
                  <p className="text-xs text-neutral-700">
                    <span className="text-amber-600 font-semibold">
                      ⚠️ Dietary avoid:
                    </span>{" "}
                    {avoids.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Scan another */}
            <div className="text-center pt-4">
              <button
                onClick={resetAll}
                className="rounded-full bg-neutral-900 text-white px-8 py-3 text-sm font-semibold hover:bg-neutral-700 transition"
              >
                Scan Another Menu
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
