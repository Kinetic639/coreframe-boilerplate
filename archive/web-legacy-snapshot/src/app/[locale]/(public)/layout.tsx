import AnnouncementBanner from "@/components/AnnouncementBanner";
import Footer from "@/components/footer";
import PublicHeader from "@/components/Header/PublicHeader";
import { PublicThemeEnforcer } from "@/components/public-theme-enforcer";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <PublicThemeEnforcer />
      {/* <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
        <div className="flex w-full max-w-7xl items-center justify-between p-3 px-5 text-sm">
          <div className="flex items-center gap-5 font-semibold">
            <Link href={"/"}>Ambra</Link>
          </div>
          <HeaderAuth />
        </div>
      </nav> */}
      <AnnouncementBanner
        message="🎉 Promocja świąteczna! Skorzystaj z 30% zniżki na wszystkie plany z kodem SWIETA2025"
        link="/pricing"
        linkText="Sprawdź ofertę"
      />
      <PublicHeader />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center lg:py-16">
        <div className="flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-20 p-5">
          {children}
        </div>
      </main>
      <Footer />
      <footer className="mx-auto mt-auto flex w-full items-center justify-center gap-8 border-t py-4 text-center text-xs"></footer>
    </div>
  );
}
