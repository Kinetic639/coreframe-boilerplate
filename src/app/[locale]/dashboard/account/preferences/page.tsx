"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

export default function PreferencesPage() {
  const t = useTranslations("PreferencesPage");
  const tLocale = useTranslations("LocaleSwitcher");
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    router.replace("/dashboard/account/preferences", { locale: newLocale });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid max-w-2xl gap-6">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              {t("theme")}
            </CardTitle>
            <CardDescription>{t("themeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="flex cursor-pointer items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Light
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="flex cursor-pointer items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Dark
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system" className="flex cursor-pointer items-center gap-2">
                  <Laptop className="h-4 w-4" />
                  System
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{t("language")}</CardTitle>
            <CardDescription>{t("languageDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="language">{t("language")}</Label>
              <Select value={locale} onValueChange={handleLocaleChange}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {routing.locales.map((cur) => (
                    <SelectItem key={cur} value={cur}>
                      {tLocale("locale", { locale: cur })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
