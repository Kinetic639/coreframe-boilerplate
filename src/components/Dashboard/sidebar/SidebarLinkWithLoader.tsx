import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Pathnames } from "@/i18n/routing";
import { WaveDotsLoader } from "@/components/WaveDotsLoader";

type Props = {
  href: Pathnames | string;
  icon: React.ReactNode;
  label: string;
  className?: string;
};

export function SidebarLinkWithLoader({ href, icon, label, className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    startTransition(() => {
      router.push(href as Pathnames);
    });
  };

  return (
    <a
      href={typeof href === "string" ? href : String(href)}
      onClick={handleClick}
      className={cn("relative flex items-center gap-2", className)}
      aria-disabled={isPending}
    >
      {icon}
      {isPending ? (
        <WaveDotsLoader />
      ) : (
        <span className="text-sm text-[color:var(--font-color)]">{label}</span>
      )}
    </a>
  );
}
