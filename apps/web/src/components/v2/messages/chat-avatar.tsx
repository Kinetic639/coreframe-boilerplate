import { cn } from "@/lib/utils";

/**
 * Square chat avatar (compact style of the Start view): initials on a muted
 * square, a group in the accent tint, a photo when there is one, and a small
 * green square when the person is online.
 */
export function ChatAvatar({
  initials,
  src,
  group = false,
  online = false,
  size = 28,
  ringClassName = "ring-sidebar",
  className,
}: {
  initials: string;
  src?: string | null;
  group?: boolean;
  online?: boolean;
  size?: 20 | 22 | 26 | 28 | 32;
  /** Colour of the gap around the online dot (match the background) */
  ringClassName?: string;
  className?: string;
}) {
  const text = size <= 22 ? "text-[9px]" : "text-[10px]";
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not optimisable
        <img src={src} alt="" className="h-full w-full rounded-md object-cover" />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center rounded-md font-semibold",
            text,
            group ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-foreground/80"
          )}
        >
          {initials}
        </span>
      )}
      {online ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-[7px] w-[7px] rounded-[2px] bg-emerald-600 ring-2",
            ringClassName
          )}
        />
      ) : null}
    </span>
  );
}

/** Small count badge (unread) in the compact style: square-ish, never a pill */
export function ChatCountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-3.5 min-w-3.5 items-center justify-center rounded px-[3px] text-[9px] font-bold leading-none tabular-nums",
        "bg-amber-700 text-white",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
