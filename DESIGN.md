# FinePrint Design System and UI Architecture

The UI is meant to be replaceable. All business logic lives in `src/lib` and `src/types`. React components only render data and call the session controller.

```
src/types/lease.ts          domain model (no React)
src/lib/**                  analysis, costs, research, privacy, report (no React)
src/hooks/use-lease-session the ONE bridge between UI and logic
src/components/**           presentational components
src/app/**                  routes / page layouts
src/styles/theme.css        design tokens
src/app/globals.css         token → Tailwind mapping, print styles
```

## Design tokens

All colors, radii, shadows and layout constants live in **`src/styles/theme.css`** as CSS variables (OKLCH colors). `src/app/globals.css` maps them to Tailwind utilities with `@theme inline`, so components use semantic classes:

| Token | Tailwind class examples | Purpose |
| --- | --- | --- |
| `--background`, `--foreground`, `--card`, `--muted`, `--border` | `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border` | Surfaces and ink |
| `--primary`, `--accent` | `bg-primary`, `text-primary`, `bg-accent` | The single brand accent (deep blue) |
| `--priority-{high,medium,low,info}` (+ `-soft`) | `bg-priority-high`, `bg-priority-high-soft` | Finding priority colors |
| `--success`, `--warning` (+ `-soft`) | `text-success`, `bg-warning-soft` | Verification and privacy states |
| `--highlight`, `--highlight-border` | `bg-highlight`, `ring-highlight-border` | Evidence highlight on the PDF |
| `--radius` | `rounded-lg`, `rounded-xl` (derived) | Corner radius scale |
| `--shadow-card`, `--shadow-raised` | `shadow-card`, `shadow-raised` | Elevation |
| `--container-max`, `--header-height` | `max-w-page`, `h-(--header-height)` | Layout |

Typography: Public Sans (UI), Source Serif 4 (lease text, headings, report title) and Geist Mono via `next/font` (self-hosted at build time, no runtime Google requests). To change fonts, swap the imports in `src/app/layout.tsx` and keep the variable names `--font-geist-sans` / `--font-serif` / `--font-geist-mono`, or rename them in `globals.css`.

### Change the theme

1. Edit values in `src/styles/theme.css`, for example `--primary: oklch(0.55 0.15 160)` for a green brand.
2. Nothing else changes; every component uses the tokens.
3. For dark mode, add a `.dark { … }` block with the same variable names and toggle the `dark` class on `<html>`. `@custom-variant dark` is already configured.

Component variants (button sizes and styles, badges, tabs) are defined with `class-variance-authority` in `src/components/ui/*`. Finding-specific display mappings (priority colors, labels) are in `src/components/findings/labels.ts`.

## Component architecture

| Folder | Components | Data in |
| --- | --- | --- |
| `components/ui` | shadcn/ui (Radix) primitives: Button, Card, Tabs, Badge, Input, Switch, … | props |
| `components/layout` | `SiteHeader`, `SiteFooter`, `Logo` (landing page chrome) | none |
| `components/landing` | `Hero`, `Benefits`, `HowItWorks`, `PrivacySection`, `WhoItsFor` | none |
| `components/upload` | `UploadScreen` (idle, loading and error states) | `useLeaseSession()` state and callbacks |
| `components/dashboard` | `DashboardApp` (shell + tabs), `AppHeader`/`AppFooter`, `SummaryStrip`, `ResearchBanner`, `LeaseViewer` (PDF canvas + highlighter marks), `OverviewTab`, `FindingsTab`, `FindingCard`, `CostsTab` (incl. corrections), `PrivacyTab`, `ReportTab` (report + landlord letter); shared pills and panels in `bits.tsx` | `useLeaseSession()`, `LeaseFinding[]`, `FinancialSummary`, audit store |
| `components/findings` | `labels.ts` only: display strings and priority colours | n/a |

**Rule:** a component never imports from `lib/analysis/rules`, `lib/costs` or `lib/research/server`. It receives computed objects. (`labels.ts` holds display strings only.)

## Replacing the dashboard without touching the engine

Everything the dashboard needs comes from one hook:

```tsx
const s = useLeaseSession();           // src/hooks/use-lease-session.ts
s.phase                                // idle | loading | error | ready
s.openFile(file); s.openSample("sample-a"); s.reset();
s.document, s.pdf                      // LeaseDocument, PDF.js proxy (null in fixture mode)
s.analysis.financial                   // FinancialSummary
s.findings                             // LeaseFinding[] with research applied, sorted
s.research                             // per-topic live/bundled status
s.overrides, s.setOverrides({...})     // user corrections → recomputes everything
s.researchMode, s.setResearchMode("live" | "bundled")
```

To build a new dashboard, create `src/components/my-dashboard.tsx`, call `useLeaseSession()`, and render the fields however you like. Swap it into `src/app/analyze/page.tsx`. The analysis engine, research, privacy guard and audit keep working unchanged.

## Replacing page layouts

- Landing: `src/app/page.tsx` composes section components. Replace or reorder them freely; none of them hold state.
- App: `src/app/analyze/page.tsx` renders `<DashboardApp/>` inside `<Suspense>` (required because it reads `useSearchParams`). Keep the Suspense wrapper if your layout reads URL params.

## Importing shadcn components

The project is initialized for shadcn with the Radix base (`components.json`, style `radix-nova`, Lucide icons):

```bash
npx shadcn@latest add dropdown-menu popover
```

Components land in `src/components/ui/`. One quirk seen during setup: some registry versions import `cn` from `"cn"`. If that happens, replace it with `import { cn } from "@/lib/utils"`.

## Adapting Tailwind UI, Magic UI or other templates

1. Copy the template's JSX into a new component under `src/components/<area>/`.
2. Replace hard-coded palette classes with tokens: `bg-white` → `bg-card`, `text-gray-900` → `text-foreground`, `text-gray-500` → `text-muted-foreground`, `bg-indigo-600` → `bg-primary`, `ring-gray-200` → `ring-border`.
3. Replace placeholder data with props typed from `src/types/lease.ts`, for example `findings: LeaseFinding[]`.
4. Magic UI components that need `framer-motion` or `motion`: install that package. Keep animations decorative, never needed to read content.
5. Do **not** add template scripts that load from CDNs or analytics. The CSP (`next.config.ts`) blocks third-party connections, and the privacy promise depends on that.

## Previewing the UI with mock data

No API credits and no PDF needed:

- `/analyze?sample=sample-a&fixture=1&research=bundled`: renders the whole dashboard from the text fixture in `src/lib/fixtures/sample-leases.ts` with bundled legal references. No network requests are made after page load.
- `/analyze?sample=sample-b&fixture=1&research=bundled`: the clean lease.
- In code or tests: `analyzeLease(sampleToDocument(SAMPLE_A))` returns a complete `AnalysisResult` for Storybook-style previews.

## Accessibility notes

Keyboard-reachable controls (native buttons, Radix Tabs and Switch), visible focus rings, `aria-expanded` on finding cards, `aria-live` on page and loading status, labeled form fields, and color never used alone (priority also has text labels). Print styles in `globals.css` print only the report.
