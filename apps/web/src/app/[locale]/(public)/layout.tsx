import AnnouncementBanner from "@/components/AnnouncementBanner";
import Footer from "@/components/footer";
import PublicHeader from "@/components/Header/PublicHeader";
import { PublicThemeEnforcer } from "@/components/public-theme-enforcer";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <PublicThemeEnforcer />
      <AnnouncementBanner
        message="🎉 Promocja świąteczna! Skorzystaj z 30% zniżki na wszystkie plany z kodem SWIETA2025"
        link="/pricing"
        linkText="Sprawdź ofertę"
      />
      <PublicHeader />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-start py-1 lg:py-2">
        <div className="flex h-full w-full max-w-7xl flex-1 flex-col items-stretch justify-start gap-2 px-3 py-1 lg:px-4 lg:py-2">
          {children}
        </div>
      </main>
      <Footer />
      <footer className="mx-auto mt-auto flex w-full items-center justify-center gap-8 border-t py-4 text-center text-xs"></footer>
    </div>
  );
}
