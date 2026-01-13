"use client";

import React, { useState } from "react";
import { NavigationMenuList, NavigationMenu } from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { LayoutDashboard, Menu, X } from "lucide-react";
import FeaturesMenu from "./FeaturesMenu";
import SolutionsMenu from "./SolutionsMenu";
import EducationalMenu from "./EducationalMenu";
import MobileMenu from "./MobileMenu";
import { useUserStore } from "@/lib/stores/user-store";
import { createClient } from "@/utils/supabase/client";

const PublicHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const supabase = createClient();
  const { user, clear } = useUserStore();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clear();
    router.refresh();
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center text-xl font-bold">
            <span className="mr-1 text-primary">Magazyn</span>Pro
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
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
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 md:flex">
            {user ? (
              <>
                <Button asChild className="gap-2">
                  <Link href="/dashboard-old/start" className="flex items-center">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button onClick={handleLogout} variant="ghost">
                  Wyloguj się
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link href="/sign-in">Zaloguj się</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Rozpocznij za darmo</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && <MobileMenu />}
    </header>
  );
};

export default PublicHeader;
