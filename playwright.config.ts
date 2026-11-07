import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Set PLAYWRIGHT_CHANNEL=chrome to use an installed Google Chrome instead of
        // downloading Playwright's Chromium (`npx playwright install chromium`).
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    // Production server; run `npm run build` first. TAVILY_API_KEY is cleared so the
    // fallback path is tested deterministically.
    command: `npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env: { TAVILY_API_KEY: "" },
  },
});
