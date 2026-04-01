import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PrivacyTerms } from "./PrivacyTerms";

interface AuthCardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
  showImage?: boolean;
  variant?: "signin" | "signup" | "forgot-password";
}

export function AuthCard({
  children,
  showImage = true,
  variant = "signin",
  className,
  ...props
}: AuthCardProps) {
  const gradients = {
    signin: {
      background:
        "bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10",
      pattern:
        "[background:radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.1),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.1),transparent_40%)]",
    },
    signup: {
      background:
        "bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 dark:from-violet-500/10 dark:via-fuchsia-500/10 dark:to-pink-500/10",
      pattern:
        "[background:radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(217,70,239,0.1),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.1),transparent_40%)]",
    },
    "forgot-password": {
      background:
        "bg-gradient-to-br from-purple-500/20 via-rose-500/20 to-orange-500/20 dark:from-purple-500/10 dark:via-rose-500/10 dark:to-orange-500/10",
      pattern:
        "[background:radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.1),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(244,63,94,0.1),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(249,115,22,0.1),transparent_40%)]",
    },
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">{children}</div>
          {showImage && (
            <div className={cn("relative hidden md:block", gradients[variant].background)}>
              <div className=" absolute inset-0" />
              <div className={cn("absolute inset-0 opacity-20", gradients[variant].pattern)} />
            </div>
          )}
        </CardContent>
      </Card>
      <PrivacyTerms />
    </div>
  );
}
