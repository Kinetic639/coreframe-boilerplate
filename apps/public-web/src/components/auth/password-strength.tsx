"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("Auth.passwordStrength");

  const requirements = [
    { label: t("requirements.length"), met: password.length >= 8 },
    { label: t("requirements.uppercase"), met: /[A-Z]/.test(password) },
    { label: t("requirements.lowercase"), met: /[a-z]/.test(password) },
    { label: t("requirements.number"), met: /\d/.test(password) },
  ];

  const strength = requirements.filter((r) => r.met).length;

  const getStrengthColor = () => {
    if (strength <= 1) return "bg-red-500";
    if (strength === 2) return "bg-orange-500";
    if (strength === 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (strength <= 1) return t("weak");
    if (strength === 2) return t("fair");
    if (strength === 3) return t("good");
    return t("strong");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              "h-2 flex-1 rounded-full transition-all duration-300",
              strength >= level ? getStrengthColor() : "bg-muted"
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t("label")}:</span>
        <span
          className={cn(
            "font-medium transition-colors",
            strength <= 1 && "text-red-500",
            strength === 2 && "text-orange-500",
            strength === 3 && "text-yellow-500",
            strength === 4 && "text-green-500"
          )}
        >
          {password.length > 0 ? getStrengthLabel() : "—"}
        </span>
      </div>
      <ul className="space-y-1.5">
        {requirements.map((req) => (
          <li
            key={req.label}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.met ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
