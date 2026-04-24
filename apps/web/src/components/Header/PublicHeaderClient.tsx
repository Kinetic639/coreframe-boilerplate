"use client";

import { useEffect, useState } from "react";
import { NavigationMenuList, NavigationMenu } from "@/components/ui/navigation-menu";
import FeaturesMenu from "./FeaturesMenu";
import SolutionsMenu from "./SolutionsMenu";
import EducationalMenu from "./EducationalMenu";
import MobileMenu from "./MobileMenu";
import { Link } from "@/i18n/navigation";
import { cn } from "@/utils";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/branding";

export function PublicHeaderClient({ showPricing = true }: { showPricing?: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLockup size="md" hoverAnimation />
        </Link>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden items-center gap-6 md:flex">
        {mounted ? (
          <NavigationMenu>
            <NavigationMenuList>
              <FeaturesMenu activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} />
              <SolutionsMenu
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
              />
              <EducationalMenu
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
              />
              {showPricing && (
                <li>
                  <Link
                    href="/pricing"
                    className={cn(
                      "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors duration-300 hover:text-primary",
                      "text-foreground"
                    )}
                  >
                    Cennik
                  </Link>
                </li>
              )}
            </NavigationMenuList>
          </NavigationMenu>
        ) : (
          <nav className="flex items-center gap-1">
            {["Funkcje", "Rozwiązania", "Materiały edukacyjne"].map((label) => (
              <span
                key={label}
                className={cn(
                  "flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground"
                )}
              >
                {label}
              </span>
            ))}
            {showPricing && (
              <Link
                href="/pricing"
                className={cn(
                  "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors duration-300 hover:text-primary",
                  "text-foreground"
                )}
              >
                Cennik
              </Link>
            )}
          </nav>
        )}
      </div>

      {/* Mobile menu button - rendered on the right side */}
      <div className="flex items-center gap-2 md:hidden">
        <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && <MobileMenu showPricing={showPricing} />}
    </>
  );
}
