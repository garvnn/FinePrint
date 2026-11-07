import type { Metadata, Viewport } from "next";
import { Geist_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// next/font downloads these at build time and serves them from this app; no request goes to Google at runtime.
// Public Sans keeps the --font-geist-sans name because globals.css maps the sans stack to it.
const uiSans = Public_Sans({ variable: "--font-geist-sans", subsets: ["latin"] });
// Lease text, wordmark, H1s and the report title: use with font-[family-name:var(--font-serif)].
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinePrint — Know Before You Sign",
  description:
    "Private, evidence-backed review of Massachusetts residential leases. Your lease is analyzed in your browser and never uploaded.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${uiSans.variable} ${serif.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
