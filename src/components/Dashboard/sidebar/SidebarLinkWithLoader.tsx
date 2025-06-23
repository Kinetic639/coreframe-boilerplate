import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Pathnames } from "@/i18n/routing";
import { Loader2 } from "lucide-react";

type Props = {
  href: Pathnames | string;
  children: React.ReactNode;
  className?: string;
};

export function SidebarLinkWithLoader({ href, children, className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    startTransition(() => {
      router.push(href as any);
    });
  };

  return (
    <a
      href={typeof href === "string" ? href : String(href)}
      onClick={handleClick}
      className={cn("relative flex items-center gap-2", className)}
      aria-disabled={isPending}
    >
      {children}

      {isPending && (
        <Loader2
          className="h-4 w-4 animate-spin text-[color:var(--font-color)] opacity-75"
          strokeWidth={2}
        />
      )}
    </a>
  );
}
