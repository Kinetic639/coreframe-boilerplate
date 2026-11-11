import { ArrowLeft } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { PageLink as Link } from "../public-site/page-link";

// A resource's own page (a specialist, a room, a service), in the tables'
// language: one slim bar with the way back, who or what it is and its
// state; the sections as underlined tabs, each its own address (rendered
// on the server, loading only what it shows); the content in sections of
// 32 px rows instead of cards, and a column beside it on a wide screen.

/** A line a little lighter than the borders, between rows. */
export const ROW_LINE = "border-[color-mix(in_srgb,var(--border)_60%,transparent)]";

export function DetailBar({
  back,
  leading,
  title,
  titleControl,
  subtitle,
  tags,
  actions,
}: {
  /** The list it belongs to. */
  back: { href: string; label: string };
  /** An avatar, a room's colour. */
  leading?: ReactNode;
  title: string;
  /**
   * The title as a control (e.g. a switch to another room): shown in its
   * place, in the heading.
   */
  titleControl?: ReactNode;
  subtitle?: string | null;
  /** Its state, as small tags. */
  tags?: ReactNode;
  /** On the right: buttons, the "⋮" menu. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
      <Link
        aria-label={`Wróć: ${back.label}`}
        className="inline-grid size-7 shrink-0 place-items-center rounded-[5px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
        href={back.href}
        title={back.label}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
      </Link>
      {leading}
      {/* The name, a little larger, and under it what they are. */}
      <div className="grid min-w-0 leading-tight">
        <h1 className="min-w-0 truncate text-[0.9375rem] font-semibold text-[var(--text)]">
          {titleControl ?? title}
        </h1>
        {subtitle ? (
          <p className="truncate text-[0.75rem] text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {tags ? (
        // On a phone, under the name (the actions stay on the first line).
        <div className="order-last flex w-full flex-wrap items-center gap-1 pl-9 sm:order-none sm:ml-1.5 sm:w-auto sm:pl-0">
          {tags}
        </div>
      ) : null}
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export interface DetailTab {
  key: string;
  label: string;
  href: string;
  /** A count after the name. */
  count?: number;
}

/** The page's sections as links (each its own address). */
export function DetailTabs({
  tabs,
  active,
  label,
}: {
  tabs: DetailTab[];
  active: string;
  /** The tabs' name, e.g. `Sekcje specjalisty`. */
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex h-[34px] shrink-0 items-stretch gap-4 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-3.5 [scrollbar-width:none]"
    >
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:text-[var(--text)] focus-visible:underline",
              current
                ? "font-medium text-[var(--text)] shadow-[inset_0_-2px_0_var(--primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
            href={tab.href}
            key={tab.key}
            scroll={false}
          >
            {tab.label}
            {tab.count !== undefined ? " " : null}
            {tab.count !== undefined ? (
              <span className="rounded-[4px] bg-[var(--surface-muted)] px-1.5 text-[0.6875rem] text-[var(--text-muted)] tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The content and, on a wide screen, a column beside it (each scrolling
 * on its own): on the right (figures, lists beside the content) or, a
 * narrower one, on the left (what the content describes, e.g. photos
 * before their form). On a phone the column comes after the content, or
 * before it when it is on the left.
 */
export function DetailBody({
  children,
  aside,
  asideLabel,
  asideSide = "right",
}: {
  children: ReactNode;
  aside?: ReactNode;
  /** The column's name, e.g. `Ten tydzień`. */
  asideLabel?: string;
  asideSide?: "left" | "right";
}) {
  const left = asideSide === "left";
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--surface)]",
        aside &&
          (left
            ? "lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:overflow-hidden"
            : "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden")
      )}
    >
      <div className={cn("min-w-0 lg:overflow-y-auto", left && "order-2")}>{children}</div>
      {aside ? (
        <aside
          aria-label={asideLabel}
          className={cn(
            "border-[var(--border)] lg:overflow-y-auto",
            left
              ? "order-1 border-b lg:border-r lg:border-b-0"
              : "border-t lg:border-t-0 lg:border-l"
          )}
        >
          {aside}
        </aside>
      ) : null}
    </div>
  );
}

/** A section: its name in a 32 px row (a note, actions), then its content. */
export function DetailSection({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-b border-[var(--border)]">
      <div className={cn("flex min-h-8 items-center gap-2 border-b px-3.5", ROW_LINE)}>
        <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]" id={id}>
          {title}
        </h2>
        {note ? (
          <span className="truncate text-[0.75rem] text-[var(--text-muted)]">{note}</span>
        ) : null}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Properties, one a row: the name, then the value. */
export function DetailProps({ children }: { children: ReactNode }) {
  return <dl>{children}</dl>;
}

export function DetailProp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-h-8 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 border-b px-3.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]",
        ROW_LINE
      )}
    >
      <dt className="text-[0.75rem] text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 py-1 text-[0.8125rem] break-words text-[var(--text)]">{children}</dd>
    </div>
  );
}

/** A small button for a bar or a section's row (`Podgląd`, `Zmień`). */
export const DETAIL_BUTTON =
  "inline-flex h-[26px] items-center gap-1.5 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[0.75rem] font-medium whitespace-nowrap text-[var(--text)] hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:opacity-50 [&_svg]:size-3.5";

/** A square icon button (the "⋮" menu's trigger). */
export const DETAIL_ICON_BUTTON =
  "inline-grid size-7 shrink-0 place-items-center rounded-[5px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none data-[state=open]:bg-[var(--surface-muted)] [&_svg]:size-4";
