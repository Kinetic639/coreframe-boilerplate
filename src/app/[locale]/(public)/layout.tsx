import HeaderAuth from "@/components/header-auth";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Link } from "@/i18n/navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
        <div className="flex w-full max-w-7xl items-center justify-between p-3 px-5 text-sm">
          <div className="flex items-center gap-5 font-semibold">
            <Link href={"/"}>CoreFrame Boilerplate</Link>
          </div>
          <HeaderAuth />
        </div>
      </nav>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-20 p-5">
          {children}
        </div>
      </main>
      <footer className="mx-auto mt-auto flex w-full items-center justify-center gap-8 border-t py-4 text-center text-xs">
        <p>
          © {new Date().getFullYear()}{" "}
          <a
            href="https://github.com/Kinetic639"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            @Kinetic639
          </a>
        </p>
        <ThemeSwitcher />
        <LocaleSwitcher />
      </footer>
    </div>
  );
}
