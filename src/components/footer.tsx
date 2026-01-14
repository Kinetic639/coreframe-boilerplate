import { Link } from "@/i18n/navigation";
import React from "react";
import { ThemeSwitcher } from "./theme-switcher";
import { ColorThemeSwitcher } from "./color-theme-switcher";
import LocaleSwitcher from "./LocaleSwitcher";

const footer = () => {
  return (
    <footer className="mt-8 border-t bg-accent/30 py-6">
      <div className="container grid grid-cols-2 gap-8 md:grid-cols-4">
        <div className="col-span-2">
          <Link href="/" className="mb-4 flex items-center text-xl font-bold">
            <span className="mr-1 text-primary">Magazyn</span>Pro
          </Link>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Nowoczesne narzędzie do zarządzania magazynem i inwentarzem dla firm każdej wielkości.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
              </svg>
            </a>
            <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
              </svg>
            </a>
            <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect width="4" height="12" x="2" y="9"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </a>
          </div>
        </div>

        {/* Footer links */}
        <div>
          <h3 className="mb-4 font-semibold">Produkt</h3>
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Funkcje
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Cennik
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Zaloguj się
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Rozpocznij za darmo
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-semibold">Rozwiązania</h3>
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Magazynowanie
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Produkcja
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Edukacja
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Placówki medyczne
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Serwis i naprawy
              </Link>
            </li>
            <li>
              <Link
                href="/"
                className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
              >
                Budownictwo
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="container mt-6 flex items-center justify-between border-t pt-6">
        <div className="text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://github.com/Kinetic639"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              @Kinetic639. Wszelkie prawa zastrzeżone.
            </a>
          </p>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-all duration-300 hover:text-foreground"
          >
            Polityka prywatności
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-all duration-300 hover:text-foreground"
          >
            Regulamin
          </Link>
          <div className="flex items-center gap-2">
            <ColorThemeSwitcher variant="icon" />
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default footer;
