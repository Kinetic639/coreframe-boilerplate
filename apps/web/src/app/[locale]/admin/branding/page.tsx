"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BrandBanner,
  BrandLoader,
  type BrandLoaderVariant,
  BrandLockup,
  BrandLogoMark,
  BrandStamp,
  BrandStampLockup,
  BrandStampLogoOnly,
  BrandStampPureBw,
  BrandStampPureBwLockup,
  BrandWatermark,
  BrandWordmark,
} from "@/components/branding";

const loaderVariants: BrandLoaderVariant[] = ["pulse", "beacon_swap"];

const stampShowcase = [
  {
    key: "stamp",
    componentName: "BrandStamp",
    render: (size: "sm" | "md" | "lg") => <BrandStamp size={size} />,
  },
  {
    key: "stamp-lockup",
    componentName: "BrandStampLockup",
    render: (size: "sm" | "md" | "lg") => <BrandStampLockup size={size} />,
  },
  {
    key: "stamp-logo-only",
    componentName: "BrandStampLogoOnly",
    render: (size: "sm" | "md" | "lg") => <BrandStampLogoOnly size={size} />,
  },
  {
    key: "stamp-pure",
    componentName: "BrandStampPureBw",
    render: (size: "sm" | "md" | "lg") => <BrandStampPureBw size={size} />,
  },
  {
    key: "stamp-pure-lockup",
    componentName: "BrandStampPureBwLockup",
    render: (size: "sm" | "md" | "lg") => <BrandStampPureBwLockup size={size} />,
  },
] as const;

export default function BrandingPage() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  async function copySnippet(snippet: string) {
    await navigator.clipboard.writeText(snippet);
    setCopiedSnippet(snippet);
    window.setTimeout(() => {
      setCopiedSnippet((current) => (current === snippet ? null : current));
    }, 1400);
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          Admin Preview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Branding System</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Reusable branding primitives for headers, banners, wordmarks, and animated loading states.
          This page is a playground so we can tune proportions before rolling them across the app.
        </p>
      </div>

      <BrandBanner
        title="Ambra branding primitives"
        description="A compact kit for product headers, public pages, empty states, and polished animated loaders based on the crystal logo."
        eyebrow="Logo, lockup, banner, motion"
      >
        <Button size="sm">Use In Public Pages</Button>
      </BrandBanner>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Logo Mark</h2>
          <p className="text-sm text-muted-foreground">
            Standalone icon sizes for navigation, badges, and compact placements.
          </p>
        </div>
        <div className="grid gap-4 rounded-3xl border bg-card p-6 md:grid-cols-5">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
            <div
              key={size}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-6"
            >
              <BrandLogoMark size={size} />
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {size}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Wordmarks & Lockups</h2>
          <p className="text-sm text-muted-foreground">
            Primary wordmark proportions and full lockups that can be reused in headers and landing
            sections.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-3xl border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Wordmark Only
            </p>
            <div className="space-y-5">
              <BrandWordmark size="sm" />
              <BrandWordmark size="md" />
              <BrandWordmark size="lg" />
              <BrandWordmark size="hero" />
            </div>
          </div>
          <div className="space-y-4 rounded-3xl border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Full Lockup
            </p>
            <div className="space-y-5">
              <BrandLockup size="sm" />
              <BrandLockup size="md" />
              <BrandLockup size="lg" />
              <BrandLockup size="hero" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Banner Variants</h2>
          <p className="text-sm text-muted-foreground">
            Brand-led hero surfaces for tool pages, empty states, promos, and documentation headers.
          </p>
        </div>
        <div className="space-y-4">
          <BrandBanner
            compact
            eyebrow="Compact Banner"
            title="Useful for tools and internal dashboards"
            description="Keeps the brand present without overpowering dense workflows."
          />
          <BrandBanner
            eyebrow="Hero Banner"
            title="A richer intro surface for landing pages and showcase screens"
            description="Warm amber gradients, crystal logo, and a tighter lockup make it feel more intentional than a generic app card."
          >
            <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Suggested use
              </p>
              <p className="mt-1 text-sm text-slate-700">Public tools, onboarding, presentations</p>
            </div>
          </BrandBanner>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Animated Loaders</h2>
          <p className="text-sm text-muted-foreground">
            Framer Motion examples that animate the crystal logo itself, without added decorative
            backgrounds or effect layers.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {loaderVariants.map((variant) => (
            <div
              key={variant}
              className="flex flex-col items-center gap-5 rounded-3xl border bg-card px-6 py-8 text-center"
            >
              <BrandLoader variant={variant} label={variant} showWordmark={false} />
              <div className="space-y-1">
                <p className="text-sm font-semibold capitalize">{variant}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {variant === "pulse" && "Breathing scale for subtle inline waiting states."}
                  {variant === "beacon_swap" &&
                    "Crossbar arms grow from the center, fill outward, then empty back toward the tips."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Monochrome Watermark</h2>
          <p className="text-sm text-muted-foreground">
            A black-and-white brand watermark that keeps the same Ambra/System lockup, just softened
            for print surfaces such as generated PDFs and exports.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl border bg-card p-10">
          <BrandWatermark className="absolute inset-0 flex items-center justify-center" />
          <div className="relative z-10 max-w-lg space-y-2">
            <p className="text-sm font-semibold">Print-safe background mark</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Kept intentionally low-contrast so it adds identity without fighting the document
              content.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Document Stamp</h2>
          <p className="text-sm text-muted-foreground">
            A compact black-and-white logo stamp family for footers, approval zones, print corners,
            and other tight document placements.
          </p>
        </div>
        <div className="space-y-3 rounded-3xl border bg-card p-4">
          {stampShowcase.map((entry) => (
            <div key={entry.key} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <div className="grid gap-3 md:grid-cols-3">
                {(["sm", "md", "lg"] as const).map((size) => (
                  <div
                    key={`${entry.key}-${size}`}
                    className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl bg-background/70 px-3 py-4"
                  >
                    {(() => {
                      const snippet = `<${entry.componentName} size="${size}" />`;
                      const copied = copiedSnippet === snippet;

                      return (
                        <>
                          {entry.render(size)}
                          <div className="flex items-center gap-1.5">
                            <code className="text-[0.62rem] text-muted-foreground">{snippet}</code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => copySnippet(snippet)}
                              aria-label={`Copy ${entry.componentName} ${size}`}
                            >
                              {copied ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
