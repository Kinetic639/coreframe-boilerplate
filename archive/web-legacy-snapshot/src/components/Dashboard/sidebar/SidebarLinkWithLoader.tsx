import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Pathnames } from "@/i18n/routing";
import { WaveDotsLoader } from "@/components/WaveDotsLoader";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/components/ui/sidebar";

type Props = {
  href: Pathnames | string;
  icon: React.ReactNode;
  label: string;
  className?: string;
};

export function SidebarLinkWithLoader({ href, icon, label, className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

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
      className={cn("relative flex w-full items-center gap-2", className)}
      aria-disabled={isPending}
    >
      {icon}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.span
            key="link-label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {isPending ? (
              <WaveDotsLoader />
            ) : (
              <span className="text-sm text-[color:var(--font-color)]">{label}</span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </a>
  );
}
