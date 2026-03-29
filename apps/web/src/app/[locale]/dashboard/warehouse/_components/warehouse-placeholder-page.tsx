import type { LucideIcon } from "lucide-react";

interface WarehousePlaceholderPageProps {
  title: string;
  description: string;
  Icon: LucideIcon;
}

export function WarehousePlaceholderPage({
  title,
  description,
  Icon,
}: WarehousePlaceholderPageProps) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Icon className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
