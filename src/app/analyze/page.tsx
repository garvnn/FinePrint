import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardApp } from "@/components/dashboard/dashboard-app";

export const metadata: Metadata = {
  title: "Analyze a lease — FinePrint",
  description: "Analyze a Massachusetts residential lease privately in your browser.",
};

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}>
      <DashboardApp />
    </Suspense>
  );
}
