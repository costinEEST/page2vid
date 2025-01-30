import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "playwright";
import Ffmpeg from "fluent-ffmpeg";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Main function to record a webpage as a video.
 * @param {string} url - The URL of the webpage to record.
 * @param {string} username - The username for login, if required.
 * @param {string} password - The password for login, if required.
 * @param {string} outputFilePath - The output path for the video.
 * @param {number} scrollSpeed - The scroll speed in milliseconds.
 */
export async function recordPage(
  url,
  username,
  password,
  outputFilePath,
  scrollSpeed = 1000
) {
  // Use persistent context with a custom user data directory
  const tempUserDataDir = join(tmpdir(), "playwright-session");
  const browser = await chromium.launchPersistentContext(tempUserDataDir, {
    headless: false, // Run in non-headless mode for better Cloudflare handling
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  // Navigate to the target page and handle authentication if redirected
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await handleAuthentication(page, url, username, password);

  // Ensure the target page is loaded after login
  await page.goto(url, { waitUntil: "networkidle" });

  // Prepare screenshots directory
  const screenshotsDir = "./screenshots";
  mkdirSync(screenshotsDir, { recursive: true });

  // Call the scrolling and screenshot capturing function
  await captureScreenshotsDuringScroll(page, screenshotsDir, scrollSpeed);

  console.log("Finished capturing screenshots.");
  await browser.close();

  // Convert screenshots to a video using FFmpeg
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
      process.exit(1);
    })
    .run();
}

/**
 * Captures screenshots while scrolling until the entire page is covered.
 * Scrolls using viewport height and captures screenshots after each scroll step.
 * @param {import('playwright').Page} page - The Playwright page instance.
 * @param {string} screenshotsDir - Directory to save the screenshots.
 * @param {number} scrollSpeed - Speed of scrolling in milliseconds.
 */
async function captureScreenshotsDuringScroll(
  page,
  screenshotsDir,
  scrollSpeed
) {
  let index = 0;

  // Use viewport height for adaptive scrolling
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  // Scroll until the bottom is reached and capture screenshots
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);

  while (previousHeight !== currentHeight) {
    previousHeight = currentHeight;

    // Capture a screenshot at the current scroll position
    const screenshotPath = `${screenshotsDir}/screenshot_${String(
      index
    ).padStart(4, "0")}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Captured: ${screenshotPath}`);
    index++;

    // Scroll down by half the viewport height and wait
    await page.evaluate((y) => window.scrollBy(0, y), viewportHeight / 2);
    await page.waitForTimeout(scrollSpeed);

    // Recalculate page height after scrolling
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
  }

  console.log("Scrolling and capturing screenshots completed.");
}

/**
 * Handles authentication if redirected to a login page.
 * @param {import('playwright').Page} page - The Playwright page instance.
 * @param {string} originalUrl - The original URL to navigate back to.
 * @param {string} username - The username for login.
 * @param {string} password - The password for login.
 */
async function handleAuthentication(page, originalUrl, username, password) {
  const loginPagePattern = /login|signin/i;

  if (loginPagePattern.test(page.url())) {
    if (!username || !password) {
      throw new Error("Authentication required but no credentials provided.");
    }

    console.log("Attempting to log in...");
    await page.fill(
      'input[name="member[email]"], input[name="username"]',
      username
    );
    await page.fill(
      'input[name="member[password]"], input[name="password"]',
      password
    );
    await page.click('button[type="submit"]');
    await page.waitForURL(originalUrl);
  }
}
