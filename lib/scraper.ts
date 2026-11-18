import * as cheerio from "cheerio";

export interface ScrapedMenuResult {
  text: string;
  title: string;
  restaurantName?: string;
  isGoogleMaps?: boolean;
}

/**
 * Extracts a restaurant name from Google Maps URLs or redirect HTML.
 */
export function extractFromGoogleMaps(url: string, html: string = ""): string | null {
  // 1. Check /place/Name in the URL
  const placeMatch = url.match(/\/place\/([^\/@?#]+)/i);
  if (placeMatch) {
    return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
  }

  // 2. Check ?q=Name in the URL
  const qMatch = url.match(/[?&]q=([^&]+)/i);
  if (qMatch) {
    return decodeURIComponent(qMatch[1].replace(/\+/g, " ")).trim();
  }

  // 3. Check HTML for canonical or meta-refresh links
  if (html) {
    const metaRefresh = html.match(/content=["'][^"']*url=([^"']+)["']/i);
    if (metaRefresh) {
      const refreshedUrl = metaRefresh[1];
      const refreshMatch = refreshedUrl.match(/\/place\/([^\/@?#]+)/i);
      if (refreshMatch) {
        return decodeURIComponent(refreshMatch[1].replace(/\+/g, " ")).trim();
      }
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].replace(/- Google Maps/i, "").trim();
      if (title && !title.toLowerCase().includes("google maps") && !title.toLowerCase().includes("dynamic link")) {
        return title;
      }
    }
  }

  return null;
}

/**
 * Parses Schema.org JSON-LD objects looking for Menu, MenuItem, or Restaurant data.
 */
function extractMenuFromJsonLd(data: unknown): string[] {
  const items: string[] = [];
  if (!data || typeof data !== "object") return items;

  if (Array.isArray(data)) {
    for (const entry of data) {
      items.push(...extractMenuFromJsonLd(entry));
    }
    return items;
  }

  const obj = data as Record<string, unknown>;
  const type = String(obj["@type"] || "");

  if (type === "MenuItem") {
    const name = obj.name ? String(obj.name) : "";
    const desc = obj.description ? String(obj.description) : "";
    if (name) items.push(`${name} - ${desc}`.trim());
  }

  if (type === "MenuSection" && Array.isArray(obj.hasMenuItem)) {
    for (const item of obj.hasMenuItem) {
      items.push(...extractMenuFromJsonLd(item));
    }
  }

  if (type === "Menu" && Array.isArray(obj.hasMenuSection)) {
    for (const sec of obj.hasMenuSection) {
      items.push(...extractMenuFromJsonLd(sec));
    }
  }

  for (const key of ["hasMenu", "hasMenuSection", "hasMenuItem", "@graph"]) {
    if (obj[key]) {
      items.push(...extractMenuFromJsonLd(obj[key]));
    }
  }

  return items;
}

/**
 * Fetches a URL and extracts readable text content.
 * Supports Google Maps links, restaurant homepages, and direct menu pages.
 */
export async function scrapeMenuText(url: string): Promise<ScrapedMenuResult> {
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  const isMaps = /maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(targetUrl);

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });

  const finalUrl = response.url || targetUrl;
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract page title or restaurant name
  const rawTitle = $("title").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();

  // If this is a Google Maps link
  if (isMaps || /google\.[a-z.]+\/maps/i.test(finalUrl)) {
    const mapsRestaurant =
      extractFromGoogleMaps(finalUrl, html) ||
      extractFromGoogleMaps(targetUrl, html) ||
      (ogTitle && !ogTitle.includes("Google") ? ogTitle : null) ||
      (rawTitle && !rawTitle.includes("Google") ? rawTitle.replace(/- Google Maps/i, "").trim() : null);

    return {
      title: mapsRestaurant || "Restaurant on Google Maps",
      restaurantName: mapsRestaurant || undefined,
      text: mapsRestaurant
        ? `Restaurant: ${mapsRestaurant}\nSource: Google Maps Link (${targetUrl})`
        : "",
      isGoogleMaps: true,
    };
  }

  const pageTitle = ogTitle || rawTitle || $("h1").first().text().trim() || "Restaurant Website";

  // Check Schema.org JSON-LD for menu items
  const jsonLdItems: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || "{}");
      jsonLdItems.push(...extractMenuFromJsonLd(parsed));
    } catch {
      // Ignore invalid JSON-LD
    }
  });

  if (jsonLdItems.length >= 2) {
    return {
      title: pageTitle,
      restaurantName: pageTitle,
      text: jsonLdItems.join("\n").slice(0, 8000),
    };
  }

  // Check if there is an explicit Menu link on the page that we should follow
  const menuLink = $('a[href*="menu"], a[href*="food"], a:contains("Menu")').first().attr("href");
  if (menuLink && !targetUrl.includes("menu")) {
    try {
      const absoluteMenuUrl = new URL(menuLink, targetUrl).toString();
      const subResponse = await fetch(absoluteMenuUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });
      if (subResponse.ok) {
        const subHtml = await subResponse.text();
        const sub$ = cheerio.load(subHtml);
        sub$("script, style, noscript, iframe, svg, nav, footer, header").remove();
        const subText = sub$("body")
          .text()
          .split("\n")
          .map((l) => l.replace(/\s+/g, " ").trim())
          .filter((l) => l.length > 0)
          .join("\n");

        if (subText.length > 150) {
          return {
            title: pageTitle,
            restaurantName: pageTitle,
            text: subText.slice(0, 8000),
          };
        }
      }
    } catch {
      // If sub-page fetch fails, continue with main page
    }
  }

  // Strip scripts and chrome
  $("script, style, noscript, iframe, svg, nav, footer, header").remove();
  $("[aria-hidden='true']").remove();

  // Look for menu sections
  const menuSelectors = [
    "[class*='menu']",
    "[id*='menu']",
    "[class*='dish']",
    "[class*='food']",
    "[class*='item']",
    "table",
    "main",
    "article",
  ];

  let menuText = "";
  for (const selector of menuSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      const text = elements
        .map((_, el) => $(el).text())
        .get()
        .join("\n");
      if (text.trim().length > 100) {
        menuText = text;
        break;
      }
    }
  }

  if (!menuText) {
    menuText = $("body").text();
  }

  const cleanedText = menuText
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .slice(0, 8000);

  // If page text is still very short (e.g. JS-rendered SPA), derive restaurant name from title or domain
  let restaurantName = pageTitle;
  if (!restaurantName || restaurantName.toLowerCase().includes("home") || restaurantName.toLowerCase().includes("welcome")) {
    try {
      const parsedUrl = new URL(targetUrl);
      restaurantName = parsedUrl.hostname.replace(/^www\./, "").split(".")[0];
      restaurantName = restaurantName.charAt(0).toUpperCase() + restaurantName.slice(1);
    } catch {}
  }

  return {
    title: pageTitle,
    restaurantName,
    text: cleanedText || `Restaurant: ${restaurantName} (${targetUrl})`,
  };
}
