import puppeteer from "puppeteer-core";
import gifencPkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifencPkg;
import pngPkg from "pngjs";
const { PNG } = pngPkg;
import fs from "fs";
import path from "path";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = path.resolve(process.cwd(), "docs");
const OUTPUT_GIF = path.join(OUTPUT_DIR, "demo.gif");

async function record() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🚀 Launching headless Chrome from:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1100,780",
    ],
    defaultViewport: {
      width: 1100,
      height: 780,
      deviceScaleFactor: 1,
    },
  });

  const page = await browser.newPage();
  const frames = [];

  async function snap(delayMs = 2500, label = "") {
    console.log(`📸 Capturing frame: ${label} (display: ${delayMs}ms)`);
    const buffer = await page.screenshot({ type: "png" });
    frames.push({ buffer, delayMs });
  }

  try {
    console.log("🌐 Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 1. Home screen overview
    await snap(3000, "1 - Clean Homepage with Active Profile & Input Selector");

    // 2. Open Preferences & Allergies drawer
    console.log("👉 Opening Preferences Drawer...");
    const prefBtn = await page.waitForSelector('button[title="Adjust allergies and taste preferences"]');
    if (prefBtn) await prefBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    await snap(3000, "2 - Preferences Drawer with Hard Allergens & Avoids");

    // Close drawer
    console.log("👉 Closing Drawer...");
    const cancelBtn = await page.$('button::-p-text("Cancel")');
    if (cancelBtn) await cancelBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    // 3. Click sample menu chip: Thai Bistro
    console.log("👉 Clicking Thai Bistro sample preset...");
    const sampleChip = await page.waitForSelector('button::-p-text("🍜 Thai Bistro")');
    if (sampleChip) await sampleChip.click();

    // 4. Loading state
    await new Promise((r) => setTimeout(r, 400));
    await snap(2000, "3 - AI Menu Scanning & Allergen Checking Loading State");

    // 5. Wait for results screen
    console.log("⏳ Waiting for Ollama Llama 3.2 recommendation analysis...");
    await page.waitForSelector('h2::-p-text("Your Curated Options")', { timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1200));

    // 6. Results view - Option 1 Selected
    await snap(3500, "4 - Curated Options (Option 1 Ready As-Is Selected)");

    // 7. Select Option 2 (Green Curry Chicken with Substitution)
    console.log("👉 Selecting Option 2 (with kitchen substitution)...");
    const optionCards = await page.$$('div[class*="rounded-2xl border"]');
    for (const card of optionCards) {
      const text = await page.evaluate((el) => el.innerText, card);
      if (text.includes("Option 2") || text.includes("Green Curry")) {
        await card.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    await snap(3500, "5 - Option 2 Selected with Server Script & Customization Callout");

    // 8. Click Copy Request button
    console.log("👉 Clicking Copy Request button...");
    const copyBtn = await page.$('button::-p-text("Copy Request")');
    if (copyBtn) await copyBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    await snap(2500, "6 - Copied Server Script Feedback");

    // 9. Scroll down to show Filtered-Out / Hard Allergen Protection
    console.log("👉 Scrolling to filtered out section...");
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: "instant" }));
    await new Promise((r) => setTimeout(r, 600));
    await snap(3500, "7 - Filtered-Out Section (Pad Thai & Tom Yum Disqualified)");

  } catch (err) {
    console.error("❌ Recording error:", err);
  } finally {
    await browser.close();
  }

  // Encode frames into animated GIF
  console.log(`🎬 Encoding ${frames.length} frames into animated GIF: ${OUTPUT_GIF}...`);
  const firstPng = PNG.sync.read(frames[0].buffer);
  const { width, height } = firstPng;

  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    const { buffer, delayMs } = frames[i];
    console.log(`  Encoding frame ${i + 1}/${frames.length}...`);
    const png = PNG.sync.read(buffer);
    const palette = quantize(png.data, 256);
    const index = applyPalette(png.data, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay: delayMs,
      repeat: 0,
    });
  }

  gif.finish();
  fs.writeFileSync(OUTPUT_GIF, Buffer.from(gif.bytes()));
  console.log(`✅ Demo GIF recorded successfully: ${OUTPUT_GIF} (${(fs.statSync(OUTPUT_GIF).size / 1024 / 1024).toFixed(2)} MB)`);
}

record().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
