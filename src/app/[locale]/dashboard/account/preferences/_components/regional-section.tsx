"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Globe, Clock } from "lucide-react";
import { routing } from "@/i18n/routing";
import { useUpdateRegionalSettingsMutation } from "@/hooks/queries/user-preferences";
import { VALID_TIMEZONES, VALID_DATE_FORMATS } from "@/lib/validations/user-preferences";
import type { UserPreferences } from "@/lib/types/user-preferences";

interface RegionalSectionProps {
  preferences: UserPreferences | null;
}

const LOCALE_LABELS: Record<string, string> = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  cs: "Čeština",
  sk: "Slovenčina",
  uk: "Українська",
  ru: "Русский",
};

const TIMEZONE_GROUPS: Record<string, readonly string[]> = {
  Europe: VALID_TIMEZONES.filter((tz) => tz.startsWith("Europe/")),
  Americas: VALID_TIMEZONES.filter((tz) => tz.startsWith("America/")),
  Asia: VALID_TIMEZONES.filter((tz) => tz.startsWith("Asia/")),
  Oceania: [
    ...VALID_TIMEZONES.filter((tz) => tz.startsWith("Australia/")),
    ...VALID_TIMEZONES.filter((tz) => tz.startsWith("Pacific/")),
  ],
  Africa: VALID_TIMEZONES.filter((tz) => tz.startsWith("Africa/")),
  Other: ["UTC"],
};

export function RegionalSection({ preferences }: RegionalSectionProps) {
  const t = useTranslations("PreferencesPage");
  const locale = useLocale();
  const router = useRouter();
  const updateRegional = useUpdateRegionalSettingsMutation();

  const [timezone, setTimezone] = useState(preferences?.timezone ?? "UTC");
  const [dateFormat, setDateFormat] = useState(preferences?.dateFormat ?? "YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState(preferences?.timeFormat ?? "24h");

  // Sync local state when preferences change externally (e.g., cross-device sync)
  useEffect(() => {
    if (preferences?.timezone) setTimezone(preferences.timezone);
  }, [preferences?.timezone]);

  useEffect(() => {
    if (preferences?.dateFormat) setDateFormat(preferences.dateFormat);
  }, [preferences?.dateFormat]);

  useEffect(() => {
    if (preferences?.timeFormat) setTimeFormat(preferences.timeFormat);
  }, [preferences?.timeFormat]);

  const datePreview = useMemo(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear());

    const formatMap: Record<string, string> = {
      "YYYY-MM-DD": `${year}-${month}-${day}`,
      "DD-MM-YYYY": `${day}-${month}-${year}`,
      "MM-DD-YYYY": `${month}-${day}-${year}`,
      "DD/MM/YYYY": `${day}/${month}/${year}`,
      "MM/DD/YYYY": `${month}/${day}/${year}`,
      "DD.MM.YYYY": `${day}.${month}.${year}`,
      "YYYY/MM/DD": `${year}/${month}/${day}`,
    };
    return formatMap[dateFormat] ?? dateFormat;
  }, [dateFormat]);

  const timePreview = useMemo(() => {
    const now = new Date();
    if (timeFormat === "12h") {
      return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    return now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }, [timeFormat]);

  const handleLocaleChange = (newLocale: string) => {
    updateRegional.mutate({ locale: newLocale });
    router.replace("/dashboard/account/preferences", { locale: newLocale });
  };

  const handleTimezoneChange = (value: string) => {
    setTimezone(value);
    updateRegional.mutate({ timezone: value });
  };

  const handleDateFormatChange = (value: string) => {
    setDateFormat(value);
    updateRegional.mutate({ dateFormat: value });
  };

  const handleTimeFormatChange = (value: string) => {
    setTimeFormat(value);
    updateRegional.mutate({ timeFormat: value });
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("language")}
          </CardTitle>
          <CardDescription>{t("languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {LOCALE_LABELS[loc] ?? loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Regional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("regional")}
          </CardTitle>
          <CardDescription>{t("regionalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Timezone */}
          <div className="space-y-2">
            <Label>{t("timezone")}</Label>
            <Select value={timezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIMEZONE_GROUPS).map(([group, zones]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {zones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Date Format */}
          <div className="space-y-2">
            <Label>{t("dateFormat")}</Label>
            <Select value={dateFormat} onValueChange={handleDateFormatChange}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(VALID_DATE_FORMATS as readonly string[]).map((fmt) => (
                  <SelectItem key={fmt} value={fmt}>
                    {fmt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("preview")}: <span className="font-mono">{datePreview}</span>
            </p>
          </div>

          <Separator />

          {/* Time Format */}
          <div className="space-y-2">
            <Label>{t("timeFormat")}</Label>
            <RadioGroup
              value={timeFormat}
              onValueChange={handleTimeFormatChange}
              className="flex gap-4"
            >
              <Label
                htmlFor="time-24h"
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors data-[state=active]:border-primary"
              >
                <RadioGroupItem value="24h" id="time-24h" />
                <span className="text-sm">{t("timeFormat24h")}</span>
              </Label>
              <Label
                htmlFor="time-12h"
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors data-[state=active]:border-primary"
              >
                <RadioGroupItem value="12h" id="time-12h" />
                <span className="text-sm">{t("timeFormat12h")}</span>
              </Label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {t("preview")}: <span className="font-mono">{timePreview}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
