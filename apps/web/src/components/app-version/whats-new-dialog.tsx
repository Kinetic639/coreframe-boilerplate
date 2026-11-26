"use client";

import { useFormatter, useTranslations } from "next-intl";
import { RELEASES, type ChangeKind, type Release } from "@repo/app-version";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BUILD_VERSION } from "@/lib/app-version";

/** How many releases the window lists; older ones stay in CHANGELOG.md. */
const MAX_RELEASES = 15;

const KIND_ORDER: ChangeKind[] = ["major", "minor", "patch", "other"];

export function WhatsNewDialog({
  open,
  onOpenChange,
  releases = RELEASES,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releases?: readonly Release[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <WhatsNewContent releases={releases} />}
    </Dialog>
  );
}

function WhatsNewContent({ releases }: { releases: readonly Release[] }) {
  const t = useTranslations("appVersion");
  const format = useFormatter();
  const shown = releases.slice(0, MAX_RELEASES);

  return (
    <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-lg">
      <DialogHeader className="border-b p-4 text-left">
        <DialogTitle>{t("whatsNewTitle")}</DialogTitle>
        <DialogDescription>
          {t("whatsNewDescription", { version: BUILD_VERSION })}
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ol className="space-y-6">
            {shown.map((release) => (
              <li key={release.version}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-base font-semibold">{release.version}</h3>
                  {release.date && (
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(`${release.date}T12:00:00Z`), {
                        dateStyle: "long",
                      })}
                    </span>
                  )}
                  {release.version === BUILD_VERSION && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("current")}
                    </Badge>
                  )}
                </div>
                {[...release.groups]
                  .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
                  .map((group) => (
                    <section key={group.kind} className="mt-2">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t(`kinds.${group.kind}`)}
                      </h4>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {group.items.map((item, i) => (
                          <li key={i} className="whitespace-pre-line">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
              </li>
            ))}
          </ol>
        )}
      </div>
    </DialogContent>
  );
}
