import type { ComponentType, ReactNode } from "react";
import { BrandLockup } from "./branding";
import { ThemeSwitcher } from "./theme-switcher";

export interface PublicFooterLink {
  href: string;
  label: string;
}

export interface PublicFooterColumn {
  title: string;
  links: PublicFooterLink[];
}

interface LinkLikeProps {
  href: string;
  className?: string;
  children: ReactNode;
}

export interface PublicFooterProps {
  description: string;
  columns: PublicFooterColumn[];
  /** e.g. "All rights reserved." / "Wszelkie prawa zastrzeżone." -- appended after the copyright line. */
  rightsReservedText: string;
  copyrightName?: string;
  copyrightHref?: string;
  legalLinks?: PublicFooterLink[];
  LinkComponent?: ComponentType<LinkLikeProps>;
  localeSwitcher?: ReactNode;
  themeSwitcher?: ReactNode;
  showThemeSwitcher?: boolean;
}

function DefaultLink({ href, className, children }: LinkLikeProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function PublicFooter({
  description,
  columns,
  rightsReservedText,
  copyrightName = "Ambra",
  copyrightHref,
  legalLinks = [],
  LinkComponent = DefaultLink,
  localeSwitcher,
  themeSwitcher,
  showThemeSwitcher = true,
}: PublicFooterProps) {
  return (
    <footer className="mt-8 border-t bg-accent/30 py-6">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-8 px-4 md:grid-cols-4">
        <div className="col-span-2">
          <LinkComponent href="/" className="mb-4 inline-flex">
            <BrandLockup size="md" />
          </LinkComponent>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">{description}</p>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="X"
            >
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
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
            </a>
            <a
              href="#"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Instagram"
            >
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
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a
              href="#"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="LinkedIn"
            >
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
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect width="4" height="12" x="2" y="9" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
          </div>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="mb-4 font-semibold">{column.title}</h3>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  <LinkComponent
                    href={link.href}
                    className="inline-block text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:text-foreground"
                  >
                    {link.label}
                  </LinkComponent>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-7xl flex-col gap-4 border-t px-4 pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()}{" "}
          {copyrightHref ? (
            <a
              href={copyrightHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {copyrightName}
            </a>
          ) : (
            copyrightName
          )}
          . {rightsReservedText}
        </p>
        <div className="flex flex-wrap items-center gap-6">
          {legalLinks.map((link) => (
            <LinkComponent
              key={link.label}
              href={link.href}
              className="transition-all duration-300 hover:text-foreground"
            >
              {link.label}
            </LinkComponent>
          ))}
          {showThemeSwitcher || themeSwitcher || localeSwitcher ? (
            <div className="flex items-center gap-2">
              {themeSwitcher ?? (showThemeSwitcher ? <ThemeSwitcher /> : null)}
              {localeSwitcher}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
