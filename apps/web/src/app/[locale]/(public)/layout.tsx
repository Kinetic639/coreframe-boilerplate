import AnnouncementBanner from "@/components/AnnouncementBanner";
import Footer from "@/components/footer";
import PublicHeader from "@/components/Header/PublicHeader";
import { PublicThemeEnforcer } from "@/components/public-theme-enforcer";
import { createServiceClient } from "@/utils/supabase/service";
import { SiteSettingsService } from "@/server/services/site-settings.service";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const settings = await SiteSettingsService.getSettings(createServiceClient());

  return (
    <div className="flex min-h-screen min-w-[320px] w-full flex-col">
      <PublicThemeEnforcer />
      {settings.announcementBannerEnabled && (
        <AnnouncementBanner
          message="🎉 Promocja świąteczna! Skorzystaj z 30% zniżki na wszystkie plany z kodem SWIETA2025"
          link="/pricing"
          linkText="Sprawdź ofertę"
        />
      )}
      <PublicHeader showPricing={settings.pricingPageEnabled} />
      <main className="flex flex-1 flex-col items-center justify-start py-4 lg:py-8">
        <div className="flex flex-1 flex-col w-full max-w-7xl items-stretch gap-2 px-4 lg:px-6">
          {children}
        </div>
      </main>
      <Footer />
      <footer className="mx-auto flex w-full items-center justify-center gap-8 border-t py-4 text-center text-xs"></footer>
    </div>
  );
}
