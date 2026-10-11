"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateNotificationSettingsMutation } from "@/hooks/queries/user-preferences";
import {
  NOTIFICATION_EVENTS,
  isEventOn,
  toggleEvent,
  type NotificationChannel,
} from "@/lib/notifications/settings";
import type { UserPreferences } from "@/lib/types/user-preferences";

const CHANNELS: NotificationChannel[] = ["inApp", "email"];
const GROUPS = ["helpdesk", "planning", "conversations"] as const;

/**
 * Event × channel matrix: which notifications reach the bell and which are
 * sent by e-mail. A column is disabled while its channel switch (above) is off.
 */
export function NotificationEventsSection({
  preferences,
}: {
  preferences: UserPreferences | null;
}) {
  const t = useTranslations("notificationCenter.settingsPage");
  const update = useUpdateNotificationSettingsMutation();
  const settings = preferences?.notificationSettings ?? {};
  const channelOn: Record<NotificationChannel, boolean> = {
    inApp: settings.inApp?.enabled ?? true,
    email: settings.email?.enabled ?? true,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm" data-testid="notification-events">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-medium">{t("event")}</th>
              {CHANNELS.map((channel) => (
                <th
                  key={channel}
                  className="w-24 py-1.5 text-center font-medium"
                  title={channelOn[channel] ? undefined : t("channelOff")}
                >
                  {t(channel)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <Fragment key={group}>
                <tr>
                  <th
                    colSpan={3}
                    scope="colgroup"
                    className="pb-1 pt-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {t(`groups.${group}`)}
                  </th>
                </tr>
                {NOTIFICATION_EVENTS.filter((event) => event.group === group).map((event) => {
                  const label = t(`events.${event.type.replace(".", "_") as "mention"}`);
                  return (
                    <tr key={event.type} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2">{label}</td>
                      {CHANNELS.map((channel) => (
                        <td key={channel} className="py-1.5 text-center">
                          {event.channels && !event.channels.includes(channel) ? (
                            <span className="text-muted-foreground" aria-hidden>
                              —
                            </span>
                          ) : (
                            <Checkbox
                              aria-label={t("toggle", { event: label, channel: t(channel) })}
                              checked={isEventOn(settings, channel, event.type)}
                              disabled={!channelOn[channel] || update.isPending}
                              onCheckedChange={(checked) =>
                                update.mutate(
                                  toggleEvent(settings, channel, event.type, checked === true)
                                )
                              }
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">{t("emailSoon")}</p>
      </CardContent>
    </Card>
  );
}
