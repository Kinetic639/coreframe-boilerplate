"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sun,
  Moon,
  Laptop,
  Check,
  Palette,
  Cloud,
  CloudUpload,
  CloudDownload,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { cn } from "@/lib/utils";
import {
  COLOR_THEMES,
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEME_CHANGE_EVENT,
} from "@/lib/constants/color-themes";
import { saveUiSettingsToCloud, loadUiSettingsFromCloud } from "@/lib/api/sync-ui-settings";

export function AppearanceSection() {
  const t = useTranslations("PreferencesPage");
  const { theme, setTheme } = useTheme();
  const setStoreTheme = useUiStoreV2((s) => s.setTheme);
  const setStoreColorTheme = useUiStoreV2((s) => s.setColorTheme);
  const hydrateFromServer = useUiStoreV2((s) => s.hydrateFromServer);
  const resetToDefaults = useUiStoreV2((s) => s.resetToDefaults);
  const getSettingsForSync = useUiStoreV2((s) => s.getSettingsForSync);
  const _lastLocalChangeAt = useUiStoreV2((s) => s._lastLocalChangeAt);

  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [cloudTimestamp, setCloudTimestamp] = useState<string | null>(null);

  // Initialize from localStorage synchronously to prevent flash
  const [currentColorTheme, setCurrentColorTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(COLOR_THEME_STORAGE_KEY) || "default";
    }
    return "default";
  });

  // Listen for color theme changes from other components (e.g. status bar)
  const handleExternalColorChange = useCallback((e: Event) => {
    const themeName = (e as CustomEvent<string>).detail;
    if (themeName) {
      setCurrentColorTheme(themeName);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    // Fetch cloud timestamp on mount
    loadUiSettingsFromCloud().then((result) => {
      if (result?.serverUpdatedAt) {
        setCloudTimestamp(result.serverUpdatedAt);
      }
    });
  }, []);

  /**
   * Save current settings to cloud
   */
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    try {
      const settings = getSettingsForSync();
      const result = await saveUiSettingsToCloud(settings);
      if (result) {
        setCloudTimestamp(result.serverUpdatedAt);
        toast.success(t("cloudSaveSuccess"));
      } else {
        toast.error(t("cloudSaveError"));
      }
    } catch {
      toast.error(t("cloudSaveError"));
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Load settings from cloud (after confirmation)
   */
  const handleLoadFromCloud = async () => {
    setShowLoadConfirm(false);
    setIsLoading(true);
    try {
      const result = await loadUiSettingsFromCloud();
      if (result?.ui) {
        // Hydrate Zustand store
        hydrateFromServer({
          theme: result.ui.theme,
          colorTheme: result.ui.colorTheme,
          sidebarCollapsed: result.ui.sidebarCollapsed,
        });
        // Update next-themes
        if (result.ui.theme) {
          setTheme(result.ui.theme);
        }
        // Update color theme DOM
        if (result.ui.colorTheme) {
          setCurrentColorTheme(result.ui.colorTheme);
          document.documentElement.setAttribute("data-theme", result.ui.colorTheme);
          localStorage.setItem(COLOR_THEME_STORAGE_KEY, result.ui.colorTheme);
          window.dispatchEvent(
            new CustomEvent(COLOR_THEME_CHANGE_EVENT, { detail: result.ui.colorTheme })
          );
        }
        if (result.serverUpdatedAt) {
          setCloudTimestamp(result.serverUpdatedAt);
        }
        toast.success(t("cloudLoadSuccess"));
      } else {
        toast.info(t("cloudNoSettings"));
      }
    } catch {
      toast.error(t("cloudLoadError"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset to defaults (after confirmation)
   */
  const handleResetToDefaults = () => {
    setShowResetConfirm(false);
    resetToDefaults();
    // Update next-themes
    setTheme("system");
    // Reset color theme
    setCurrentColorTheme("default");
    document.documentElement.setAttribute("data-theme", "default");
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, "default");
    window.dispatchEvent(new CustomEvent(COLOR_THEME_CHANGE_EVENT, { detail: "default" }));
    toast.success(t("resetSuccess"));
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return t("never");
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return t("never");
    }
  };

  useEffect(() => {
    window.addEventListener(COLOR_THEME_CHANGE_EVENT, handleExternalColorChange);
    return () => window.removeEventListener(COLOR_THEME_CHANGE_EVENT, handleExternalColorChange);
  }, [handleExternalColorChange]);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    setStoreTheme(value as "light" | "dark" | "system");
  };

  const handleColorThemeChange = (themeName: string) => {
    setCurrentColorTheme(themeName);
    setStoreColorTheme(themeName);
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, themeName);
    window.dispatchEvent(new CustomEvent(COLOR_THEME_CHANGE_EVENT, { detail: themeName }));
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {t("appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {t("theme")}
          </CardTitle>
          <CardDescription>{t("themeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={handleThemeChange}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {[
              { value: "light", icon: Sun },
              { value: "dark", icon: Moon },
              { value: "system", icon: Laptop },
            ].map(({ value, icon: Icon }) => (
              <Label
                key={value}
                htmlFor={`theme-${value}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value={value} id={`theme-${value}`} />
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t(value as "light" | "dark" | "system")}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Color Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t("colorTheme")}
          </CardTitle>
          <CardDescription>{t("colorThemeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COLOR_THEMES.map((ct) => (
              <button
                key={ct.name}
                type="button"
                onClick={() => handleColorThemeChange(ct.name)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors",
                  currentColorTheme === ct.name
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex gap-0.5 shrink-0">
                  {ct.colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-4 w-4 rounded-sm border border-border/50"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium truncate">{ct.label}</span>
                {currentColorTheme === ct.name && (
                  <Check className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cloud Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            {t("cloudSync")}
          </CardTitle>
          <CardDescription>{t("cloudSyncDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status block */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">{t("lastLocalChange")}:</span>
                <span className="ml-2 font-medium">{formatTimestamp(_lastLocalChangeAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("lastCloudSync")}:</span>
                <span className="ml-2 font-medium">{formatTimestamp(cloudTimestamp)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveToCloud}
              disabled={isSaving || isLoading}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4 mr-2" />
              )}
              {t("saveToCloud")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLoadConfirm(true)}
              disabled={isSaving || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4 mr-2" />
              )}
              {t("loadFromCloud")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
              disabled={isSaving || isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("resetDefaults")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Load from cloud confirmation dialog */}
      <AlertDialog open={showLoadConfirm} onOpenChange={setShowLoadConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("loadFromCloudTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("loadFromCloudDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadFromCloud}>{t("confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset to defaults confirmation dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("resetDefaultsTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("resetDefaultsDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetToDefaults}>{t("confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
