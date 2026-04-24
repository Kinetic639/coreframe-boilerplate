"use client";

import { useState, useTransition } from "react";
import { toast } from "react-toastify";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateSiteSettingsAction } from "@/app/actions/admin/site-settings";
import type { SiteSettings } from "@/server/services/site-settings.service";

interface Props {
  initialSettings: SiteSettings;
}

interface SettingRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (value: boolean) => void;
}

function SettingRow({ id, label, description, checked, disabled, onToggle }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-card p-5">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onToggle} />
    </div>
  );
}

export function SiteSettingsClient({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof SiteSettings, value: boolean) {
    const optimistic = { ...settings, [key]: value };
    setSettings(optimistic);

    startTransition(async () => {
      const result = await updateSiteSettingsAction({ [key]: value });
      if (!result.success) {
        setSettings(settings);
        toast.error(`Failed to save: ${"error" in result ? result.error : "Unknown error"}`);
      } else {
        toast.success("Setting saved");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-3">
      <SettingRow
        id="announcement-banner"
        label="Announcement banner"
        description="Show the promotional ribbon at the top of all public pages."
        checked={settings.announcementBannerEnabled}
        disabled={isPending}
        onToggle={(v) => toggle("announcementBannerEnabled", v)}
      />
      <SettingRow
        id="pricing-page"
        label="Pricing page"
        description="Show the /pricing page and its link in the public navigation. When disabled, the page returns 404."
        checked={settings.pricingPageEnabled}
        disabled={isPending}
        onToggle={(v) => toggle("pricingPageEnabled", v)}
      />
    </div>
  );
}
