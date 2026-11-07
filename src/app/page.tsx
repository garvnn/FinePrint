import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { Benefits, FinalCta, HowItWorks, PrivacySection, RentersSection } from "@/components/landing/sections";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Benefits />
        <HowItWorks />
        <PrivacySection />
        <RentersSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
