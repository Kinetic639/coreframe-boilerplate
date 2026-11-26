import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TicketTypeRef } from "@/server/requests/types";

/** Request type as a colored dot and its name (the color set in Ambra's Help Desk). */
export function TypeLabel({
  type,
  boxed = false,
  className,
}: {
  type: TicketTypeRef | null;
  /** Outlined, as in the request header. */
  boxed?: boolean;
  className?: string;
}) {
  const t = useTranslations("requests");
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 text-sm",
        boxed && "h-7 rounded-md border bg-background px-2.5",
        !type && "text-muted-foreground",
        className
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: type?.color ?? "var(--muted-foreground)" }}
      />
      <span className="truncate">{type?.name ?? t("noType")}</span>
    </span>
  );
}
