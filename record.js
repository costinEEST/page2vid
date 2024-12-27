import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "playwright";
import Ffmpeg from "fluent-ffmpeg";

export async function recordPage(
  url,
  username,
  password,
  outputFilePath,
  scrollSpeed = 1000
) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url);

  // Handle login (if required)
  if (username && password) {
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url);
  }

  await page.waitForLoadState("networkidle");

  const screenshotsDir = "./screenshots";
  mkdirSync(screenshotsDir, { recursive: true });

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  let scrollY = 0;
  let index = 0;

  while (scrollY < pageHeight) {
    const screenshotPath = `${screenshotsDir}/screenshot_${String(
      index
    ).padStart(4, "0")}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    scrollY += viewportHeight / 2;
    await page.evaluate((y) => window.scrollBy(0, y), viewportHeight / 2);
    await page.waitForTimeout(scrollSpeed);
    index++;
  }

  await browser.close();

  Ffmpeg()
    .addInput(`${screenshotsDir}/screenshot_%04d.png`)
    .inputFPS(1)
    .output(outputFilePath)
    .outputOptions("-vf", "fps=30")
    .on("end", () => {
      console.log(`Video saved to ${outputFilePath}`);

      rmSync(screenshotsDir, { recursive: true, force: true });
    })
    .on("error", (err) => {
      console.error("Error creating video:", err.message);
    })
    .run();
}
