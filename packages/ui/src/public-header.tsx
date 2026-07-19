"use client";

import type { ComponentType, ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "./branding";
import { Button } from "./button";
import { cn } from "./utils";

export interface PublicHeaderLink {
  href: string;
  label: string;
}

interface LinkLikeProps {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

export interface PublicHeaderShellProps {
  nav?: ReactNode;
  mobileNav?: ReactNode;
  mobileContent?: ReactNode;
  actions?: ReactNode;
  mobileActions?: ReactNode;
  LinkComponent?: ComponentType<LinkLikeProps>;
  brandHref?: string;
  brandSubtitle?: string;
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

function DefaultLink({ href, className, children, onClick }: LinkLikeProps) {
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export function PublicHeaderShell({
  nav,
  mobileNav,
  mobileContent,
  actions,
  mobileActions,
  LinkComponent = DefaultLink,
  brandHref = "/",
  brandSubtitle = "System",
  mobileMenuOpen,
  onMobileMenuChange,
}: PublicHeaderShellProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <LinkComponent
            href={brandHref}
            className="flex items-center gap-2.5"
            onClick={() => onMobileMenuChange(false)}
          >
            <BrandLockup size="md" subtitle={brandSubtitle} hoverAnimation />
          </LinkComponent>
        </div>

        {nav ? <div className="hidden items-center gap-6 md:flex">{nav}</div> : null}
        {actions ? <div className="hidden items-center gap-4 md:flex">{actions}</div> : null}

        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMobileMenuChange(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Zamknij menu" : "Otwórz menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && mobileContent ? mobileContent : null}

      {mobileMenuOpen && !mobileContent ? (
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col px-4 py-4">
            {mobileNav ?? nav}
            {mobileActions ? (
              <div className="mt-3 grid grid-cols-1 gap-2 border-t pt-4">{mobileActions}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PublicHeaderNavLinks({
  links,
  LinkComponent = DefaultLink,
  onNavigate,
  className,
}: {
  links: PublicHeaderLink[];
  LinkComponent?: ComponentType<LinkLikeProps>;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col md:flex-row md:items-center md:gap-6", className)}>
      {links.map((link) => (
        <LinkComponent
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className="rounded-md px-3 py-3 text-sm font-medium text-foreground transition-colors duration-300 hover:bg-accent hover:text-primary md:px-4 md:py-2 md:hover:bg-transparent"
        >
          {link.label}
        </LinkComponent>
      ))}
    </nav>
  );
}
