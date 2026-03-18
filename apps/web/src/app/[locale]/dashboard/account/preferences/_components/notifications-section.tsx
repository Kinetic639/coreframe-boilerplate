"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { useUpdateNotificationSettingsMutation } from "@/hooks/queries/user-preferences";
import type { UserPreferences } from "@/lib/types/user-preferences";

interface NotificationsSectionProps {
  preferences: UserPreferences | null;
}

export function NotificationsSection({ preferences }: NotificationsSectionProps) {
  const t = useTranslations("PreferencesPage");
  const updateNotifications = useUpdateNotificationSettingsMutation();

  const notifSettings = preferences?.notificationSettings ?? {};

  const [emailEnabled, setEmailEnabled] = useState(notifSettings.email?.enabled ?? true);
  const [inAppEnabled, setInAppEnabled] = useState(notifSettings.inApp?.enabled ?? true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    notifSettings.quietHours?.enabled ?? false
  );
  const [quietStart, setQuietStart] = useState(notifSettings.quietHours?.start ?? "22:00");
  const [quietEnd, setQuietEnd] = useState(notifSettings.quietHours?.end ?? "07:00");

  // Sync local state when preferences change externally (e.g., cross-device sync)
  useEffect(() => {
    setEmailEnabled(notifSettings.email?.enabled ?? true);
  }, [notifSettings.email?.enabled]);

  useEffect(() => {
    setInAppEnabled(notifSettings.inApp?.enabled ?? true);
  }, [notifSettings.inApp?.enabled]);

  useEffect(() => {
    setQuietHoursEnabled(notifSettings.quietHours?.enabled ?? false);
  }, [notifSettings.quietHours?.enabled]);

  useEffect(() => {
    if (notifSettings.quietHours?.start) setQuietStart(notifSettings.quietHours.start);
  }, [notifSettings.quietHours?.start]);

  useEffect(() => {
    if (notifSettings.quietHours?.end) setQuietEnd(notifSettings.quietHours.end);
  }, [notifSettings.quietHours?.end]);

  // Debounce quiet hours time changes to prevent API spam during rapid typing
  const quietHoursTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedQuietHoursSync = useCallback(
    (start: string, end: string) => {
      if (quietHoursTimeoutRef.current) {
        clearTimeout(quietHoursTimeoutRef.current);
      }
      quietHoursTimeoutRef.current = setTimeout(() => {
        updateNotifications.mutate({
          quietHours: {
            enabled: true,
            start,
            end,
            timezone: preferences?.timezone ?? "UTC",
          },
        });
      }, 500);
    },
    [updateNotifications, preferences?.timezone]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (quietHoursTimeoutRef.current) {
        clearTimeout(quietHoursTimeoutRef.current);
      }
    };
  }, []);

  const handleEmailToggle = (checked: boolean) => {
    setEmailEnabled(checked);
    updateNotifications.mutate({
      email: { enabled: checked },
    });
  };

  const handleInAppToggle = (checked: boolean) => {
    setInAppEnabled(checked);
    updateNotifications.mutate({
      inApp: { enabled: checked },
    });
  };

  const handleQuietHoursToggle = (checked: boolean) => {
    setQuietHoursEnabled(checked);
    updateNotifications.mutate({
      quietHours: {
        enabled: checked,
        start: quietStart,
        end: quietEnd,
        timezone: preferences?.timezone ?? "UTC",
      },
    });
  };

  const handleQuietTimeChange = (field: "start" | "end", value: string) => {
    const newStart = field === "start" ? value : quietStart;
    const newEnd = field === "end" ? value : quietEnd;

    if (field === "start") setQuietStart(value);
    else setQuietEnd(value);

    if (quietHoursEnabled) {
      debouncedQuietHoursSync(newStart, newEnd);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("notifications")}
        </CardTitle>
        <CardDescription>{t("notificationsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="email-notif">{t("emailNotifications")}</Label>
            <p className="text-xs text-muted-foreground">{t("emailNotificationsDescription")}</p>
          </div>
          <Switch id="email-notif" checked={emailEnabled} onCheckedChange={handleEmailToggle} />
        </div>

        <Separator />

        {/* Push - Coming Soon */}
        <div className="flex items-center justify-between gap-4 opacity-60">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label>{t("pushNotifications")}</Label>
              <Badge variant="secondary" className="text-xs">
                {t("comingSoon")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t("pushNotificationsDescription")}</p>
          </div>
          <Switch disabled checked={false} />
        </div>

        <Separator />

        {/* In-App */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="inapp-notif">{t("inAppNotifications")}</Label>
            <p className="text-xs text-muted-foreground">{t("inAppNotificationsDescription")}</p>
          </div>
          <Switch id="inapp-notif" checked={inAppEnabled} onCheckedChange={handleInAppToggle} />
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours">{t("quietHours")}</Label>
              <p className="text-xs text-muted-foreground">{t("quietHoursDescription")}</p>
            </div>
            <Switch
              id="quiet-hours"
              checked={quietHoursEnabled}
              onCheckedChange={handleQuietHoursToggle}
            />
          </div>
          {quietHoursEnabled && (
            <div className="flex items-center gap-3 pl-0 sm:pl-4">
              <div className="space-y-1">
                <Label htmlFor="quiet-start" className="text-xs">
                  {t("startTime")}
                </Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietStart}
                  onChange={(e) => handleQuietTimeChange("start", e.target.value)}
                  className="w-28"
                />
              </div>
              <span className="mt-5 text-muted-foreground">—</span>
              <div className="space-y-1">
                <Label htmlFor="quiet-end" className="text-xs">
                  {t("endTime")}
                </Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietEnd}
                  onChange={(e) => handleQuietTimeChange("end", e.target.value)}
                  className="w-28"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
