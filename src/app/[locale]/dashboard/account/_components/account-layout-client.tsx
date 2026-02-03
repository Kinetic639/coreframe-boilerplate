"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { User, Settings } from "lucide-react";

interface AccountLayoutClientProps {
  children: React.ReactNode;
}

const tabs = [
  { id: "preferences", href: "/dashboard/account/preferences" as const, icon: Settings },
  { id: "profile", href: "/dashboard/account/profile" as const, icon: User },
] as const;

export function AccountLayoutClient({ children }: AccountLayoutClientProps) {
  const pathname = usePathname();
  const t = useTranslations("AccountPage");

  return (
    <div>
      <nav className="mb-6 flex gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname.endsWith(tab.href) || pathname.endsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tab.id)}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
