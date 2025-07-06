import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: keyof typeof Icons;
}

const Icon = ({ name, className, ...props }: IconProps) => {
  const LucideIcon = Icons[name];

  if (!LucideIcon) {
    // Fallback to a default icon if the specified icon is not found
    return <Icons.MapPin className={cn(className)} {...props} />;
  }

  return <LucideIcon className={cn(className)} {...props} />;
};

export { Icon };
