import { expect, test, type Request } from "@playwright/test";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SAMPLE_B = join(ROOT, "public", "samples", "fineprint-sample-lease-b.pdf");
const SAMPLE_A = join(ROOT, "public", "samples", "fineprint-sample-lease-a.pdf");

function track(page: import("@playwright/test").Page) {
  const requests: Request[] = [];
  page.on("request", (r) => requests.push(r));
  return requests;
}

test("landing page renders the product story", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Know Before You Sign.");
  await expect(page.getByRole("link", { name: /Upload lease/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Try sample lease/ }).first()).toBeVisible();
  const csp = (await page.request.get("/")).headers()["content-security-policy"];
  expect(csp).toContain("connect-src 'self'");
});

test("demo mode: sample lease analysis, evidence highlight, zero research requests", async ({ page }) => {
  const requests = track(page);
  await page.goto("/analyze?sample=sample-a&research=bundled");
  await expect(page.getByText("Due at signing")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("$6,725").first()).toBeVisible();
  await expect(page.getByText(/Demo mode/)).toBeVisible();

  await page.getByRole("tab", { name: /Findings/ }).click();
  await page.getByRole("button", { name: /Security deposit is \$900 more than one month's rent/ }).click();
  await expect(page.getByText("Highlighted: the lines containing the cited clause.")).toBeVisible();
  await expect(page.locator("aside .bg-highlight").first()).toBeVisible();
  await expect(page.getByText("Bundled reference, not live").first()).toBeVisible();

  expect(requests.filter((r) => r.url().includes("/api/research"))).toHaveLength(0);
});

test("live mode without a Tavily key shows the honest fallback and only sends topic IDs", async ({ page }) => {
  const requests = track(page);
  await page.goto("/analyze?sample=sample-a");
  await expect(page.getByText(/Live verification unavailable/)).toBeVisible({ timeout: 20_000 });
  const research = requests.filter((r) => r.url().includes("/api/research"));
  expect(research.length).toBeGreaterThan(0);
  for (const r of research) {
    const body = JSON.parse(r.postData() ?? "{}");
    expect(Object.keys(body).sort()).toEqual(["jurisdiction", "topicId"]);
    expect(body.jurisdiction).toBe("MA");
    expect(body.topicId).toMatch(/^ma-[a-z-]+$/);
  }
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByText("not forwarded (server has no Tavily key)").first()).toBeVisible();
});

test("uploading a PDF never sends the file anywhere", async ({ page }) => {
  const requests = track(page);
  await page.goto("/analyze");
  await page.getByTestId("file-input").setInputFiles(SAMPLE_B);
  await expect(page.getByText("$6,350").first()).toBeVisible({ timeout: 20_000 });
  const origin = new URL(page.url()).origin;
  for (const r of requests) {
    expect(new URL(r.url()).origin).toBe(origin);
    const body = r.postDataBuffer();
    if (body) {
      expect(body.length).toBeLessThan(256);
      expect(body.toString("latin1")).not.toContain("%PDF");
    }
  }
});

test("rejects invalid and scanned PDFs with clear errors", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByTestId("file-input").setInputFiles(join(ROOT, "tests", "fixtures", "not-a-pdf.pdf"));
  await expect(page.getByTestId("upload-error")).toContainText("does not look like a valid PDF");
  await page.getByTestId("file-input").setInputFiles(join(ROOT, "tests", "fixtures", "scanned.pdf"));
  await expect(page.getByTestId("upload-error")).toContainText("no extractable text");
});

test("cost corrections recalculate findings locally", async ({ page }) => {
  await page.goto("/analyze?sample=sample-a&research=bundled");
  await expect(page.getByText("Due at signing")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "Costs" }).click();
  await page.getByLabel("Security deposit ($)").fill("1800");
  await page.getByRole("button", { name: "Recalculate" }).click();
  await expect(page.getByText("$5,825").first()).toBeVisible();
  await page.getByRole("tab", { name: /Findings/ }).click();
  await expect(page.getByRole("button", { name: /Security deposit is \$900 more/ })).toHaveCount(0);
});

test("report renders with landlord letter", async ({ page }) => {
  await page.goto("/analyze?sample=sample-a&research=bundled");
  await expect(page.getByText("Due at signing")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "Report" }).click();
  await expect(page.getByRole("heading", { name: "Before You Sign: Lease Report" })).toBeVisible();
  await expect(page.getByLabel("Landlord message draft")).toHaveValue(/\$2,700/);
});

test("mobile layout has no horizontal overflow", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const url of ["/", "/analyze", "/analyze?sample=sample-a&research=bundled"]) {
    await page.goto(url);
    if (url.includes("sample")) await expect(page.getByText("Due at signing")).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test("research API rejects lease text over HTTP", async ({ request }) => {
  const res = await request.post("/api/research", {
    data: { topicId: "ma-late-fees", jurisdiction: "MA", text: "Tenant shall pay a security deposit of $2,700.00" },
  });
  expect(res.status()).toBe(400);
  void SAMPLE_A;
});
