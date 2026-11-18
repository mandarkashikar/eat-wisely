import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UserProfile } from "@/lib/types";
import { analyzeMenuWithOllama } from "@/lib/agent";
import { scrapeMenuText } from "@/lib/scraper";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[API /api/analyze] Incoming request body:", JSON.stringify(body).slice(0, 500));

    let { menuText } = body;
    const { url, profile: customProfile } = body;

    let sourceTitle = "";
    let restaurantContext = "";

    // If a URL was provided, scrape it or extract place info
    if (url && typeof url === "string" && url.trim()) {
      try {
        const scraped = await scrapeMenuText(url.trim());
        sourceTitle = scraped.restaurantName || scraped.title || "";
        menuText = scraped.text || "";
        restaurantContext = scraped.restaurantName || scraped.title || "";
      } catch (scrapeErr) {
        console.error("[API /api/analyze] Scraping error:", scrapeErr);
        return NextResponse.json(
          {
            error: `Could not fetch menu from the link: ${
              scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)
            }`,
          },
          { status: 422 }
        );
      }
    }

    if ((!menuText || !menuText.trim()) && !restaurantContext) {
      return NextResponse.json(
        { error: "Could not extract menu text or restaurant details. Please upload a file, paste the menu text, or check the URL." },
        { status: 400 }
      );
    }

    let profile: UserProfile = customProfile;
    if (!profile) {
      const profilePath = path.resolve(
        process.cwd(),
        "data/profiles/example-profile.json"
      );
      profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
    }

    const effectiveText = menuText && menuText.trim() ? menuText.trim() : `Restaurant: ${restaurantContext}`;
    const result = await analyzeMenuWithOllama(effectiveText, profile, {
      restaurantContext,
    });

    return NextResponse.json({
      success: true,
      result,
      sourceTitle,
      profile,
    });
  } catch (error) {
    console.error("API Error in /api/analyze:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during analysis.",
      },
      { status: 500 }
    );
  }
}
