"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Download, Laptop, Smartphone, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IosInstallDialog } from "@/components/pwa/ios-install-dialog";
import { announcePushResult } from "@/components/pwa/push-result-toast";
import { formatDateTime } from "@/lib/date-time/format";
import { currentSubscription, describeUserAgent } from "@/lib/push/client";
import type { PushDevice } from "@/lib/push/types";
import { usePwaStore } from "@/lib/stores/v2/pwa-store";
import { cn } from "@/lib/utils";

const DEVICES_KEY = ["push-devices"] as const;

async function fetchDevices(): Promise<PushDevice[]> {
  const response = await fetch("/api/push/subscription", { cache: "no-store" });
  if (!response.ok) throw new Error("devices");
  return ((await response.json()) as { devices: PushDevice[] }).devices;
}

/**
 * Konto → Powiadomienia: push on this device (on/off, install hints) and the
 * list of the user's devices that receive push, each removable.
 */
export function PushDevicesSection() {
  const t = useTranslations("notificationCenter.push");
  const td = useTranslations("notificationCenter.push.devices");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const pushState = usePwaStore((s) => s.pushState);
  const busy = usePwaStore((s) => s.busy);
  const canInstall = usePwaStore((s) => s.canInstall);
  const installed = usePwaStore((s) => s.installed);
  const { enable, disable, install, refresh } = usePwaStore.getState();
  const [iosOpen, setIosOpen] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);

  const devices = useQuery({ queryKey: DEVICES_KEY, queryFn: fetchDevices, staleTime: 30_000 });

  useEffect(() => {
    void refresh();
    const { browser, os } = describeUserAgent(navigator.userAgent);
    setThisDevice(browser && os ? td("name", { browser, os }) : (browser ?? os));
  }, [refresh, td]);

  useEffect(() => {
    void currentSubscription().then((subscription) =>
      setCurrentEndpoint(subscription?.endpoint ?? null)
    );
  }, [pushState]);

  const reload = () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY });

  const deviceName = (device: PushDevice) => {
    const { browser, os } = describeUserAgent(device.user_agent);
    const name = browser && os ? td("name", { browser, os }) : (browser ?? os ?? td("unknown"));
    return device.standalone ? `${name} · ${td("app")}` : name;
  };

  const remove = async (device: PushDevice) => {
    if (device.endpoint === currentEndpoint) {
      await disable();
    } else {
      const response = await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: device.id }),
      }).catch(() => null);
      if (!response?.ok) {
        toast.error(t("result.removeFailed"));
        return;
      }
    }
    toast.success(t("result.removed"));
    await reload();
  };

  const stateKey =
    pushState === "ios-install" ? "iosInstall" : pushState === "loading" ? "loading" : pushState;
  const list = devices.data ?? [];

  return (
    <Card data-testid="push-devices">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          {td("title")}
        </CardTitle>
        <CardDescription>{td("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center",
            pushState === "off" || pushState === "ios-install"
              ? "border-primary/35 bg-primary/10"
              : "bg-muted/40"
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Laptop className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {thisDevice ? td("thisDevice", { name: thisDevice }) : td("thisDeviceUnknown")}
              </p>
              <p className="text-xs text-muted-foreground" data-testid="push-state">
                {td(`state.${stateKey}`)}
              </p>
            </div>
          </div>
          {pushState === "off" ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                const result = await enable();
                announcePushResult(result, t);
                await reload();
              }}
            >
              <BellRing className="size-4" />
              {td("enable")}
            </Button>
          ) : pushState === "on" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                await disable();
                toast.info(t("result.off"));
                await reload();
              }}
            >
              {td("disable")}
            </Button>
          ) : pushState === "ios-install" ? (
            <Button size="sm" onClick={() => setIosOpen(true)}>
              {td("iosHow")}
            </Button>
          ) : null}
        </div>

        {canInstall && !installed ? (
          <div className="flex items-center gap-3">
            <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="flex-1 text-xs text-muted-foreground">{td("installHint")}</p>
            <Button size="sm" variant="outline" onClick={() => void install()}>
              {t("install")}
            </Button>
          </div>
        ) : null}

        <Separator />

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{td("listTitle")}</p>
          {list.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {devices.isLoading ? td("state.loading") : td("empty")}
            </p>
          ) : (
            <ul className="divide-y" data-testid="push-device-list">
              {list.map((device) => {
                const name = deviceName(device);
                const mobile = describeUserAgent(device.user_agent).mobile;
                const Icon = mobile ? Smartphone : Laptop;
                return (
                  <li key={device.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {name}
                        {device.endpoint === currentEndpoint ? (
                          <span className="text-muted-foreground"> · {td("current")}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {td("lastUsed", {
                          date: formatDateTime(device.last_seen_at, locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label={td("remove", { name })}
                      title={td("remove", { name })}
                      onClick={() => void remove(device)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
      <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
    </Card>
  );
}
