import { cn } from "@/lib/utils";
import type { PersonRef } from "@/server/requests/types";

const PALETTE = [
  ["#FDE68A", "#78350F"],
  ["#BFDBFE", "#1E3A8A"],
  ["#BBF7D0", "#14532D"],
  ["#DDD6FE", "#4C1D95"],
  ["#FBCFE8", "#831843"],
  ["#FED7AA", "#7C2D12"],
  ["#C7F0E4", "#134E4A"],
] as const;

function colorsFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

/** Overlapping avatars (responders); the rest as "+n". */
export function AvatarStack({
  people,
  size = 24,
  max = 3,
  className,
}: {
  people: PersonRef[];
  size?: number;
  max?: number;
  className?: string;
}) {
  if (people.length === 0) return null;
  const rest = people.length - max;
  return (
    <span
      className={cn("flex items-center", className)}
      title={people.map((p) => p.name).join(", ")}
    >
      {people.slice(0, max).map((p, i) => (
        <Avatar
          key={p.id}
          person={p}
          size={size}
          className={cn("ring-2 ring-card", i > 0 && "-ml-1")}
        />
      ))}
      {rest > 0 && (
        <span
          className="-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export function Avatar({
  person,
  size = 24,
  className,
}: {
  person: PersonRef | null;
  size?: number;
  className?: string;
}) {
  if (!person) return null;
  const [bg, fg] = colorsFor(person.id);
  return (
    <span
      title={person.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        className
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        person.initials
      )}
    </span>
  );
}
