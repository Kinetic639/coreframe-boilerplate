import { generatePublicMetadata } from "@/lib/metadata";
import { HomeIntro } from "./_components/home-intro";
import { HomeHero } from "./_components/home-hero";
import { HomeLogoMarquee, HomeStatsBar } from "./_components/home-stats-marquee";
import { HomeFeaturesGrid } from "./_components/home-features-grid";
import { HomeHowItWorks } from "./_components/home-how-it-works";
import { HomeParallaxImage } from "./_components/home-parallax-image";
import { HomeStickyText } from "./_components/home-sticky-text";
import { HomeHorizontalScroll } from "./_components/home-horizontal-scroll";
import { HomeSplitParallax } from "./_components/home-split-parallax";
import { HomeStaggerCards } from "./_components/home-stagger-cards";
import { HomePerspectiveMarquee } from "./_components/home-perspective-marquee";
import { HomeScrollProgress } from "./_components/home-scroll-progress";
import { HomeBentoSpotlight } from "./_components/home-bento-spotlight";
import { HomeSvgPath } from "./_components/home-svg-path";
import { HomeCardStack } from "./_components/home-card-stack";
import { HomeTestimonials } from "./_components/home-testimonials";
import { HomePricingTeaser } from "./_components/home-pricing-teaser";
import { HomeCTA } from "./_components/home-cta";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  return generatePublicMetadata(params, "metadata.public.home", [
    "SaaS platform",
    "warehouse management",
    "inventory tracking",
    "business management",
    "enterprise software",
    "Next.js",
    "Supabase",
    "zarządzanie magazynem",
    "platforma SaaS",
  ]);
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <HomeIntro />
      <HomeHero />
      <HomeLogoMarquee />
      <HomeStatsBar />
      <HomeFeaturesGrid />
      <HomeHowItWorks />
      <HomeParallaxImage />
      <HomeStickyText />
      <HomeHorizontalScroll />
      <HomeSplitParallax />
      <HomeStaggerCards />
      <HomePerspectiveMarquee />
      <HomeScrollProgress />
      <HomeBentoSpotlight />
      <HomeSvgPath />
      <HomeCardStack />
      <HomeTestimonials />
      <HomePricingTeaser />
      <HomeCTA />
    </main>
  );
}
