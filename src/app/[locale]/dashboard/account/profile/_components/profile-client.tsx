"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, Shield } from "lucide-react";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePreferencesQuery, useUpdateProfileMutation } from "@/hooks/queries/user-preferences";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import { CopyToClipboard } from "@/components/v2/utility/copy-to-clipboard";

interface ProfileClientProps {
  translations: {
    description: string;
  };
}

export function ProfileClient({ translations }: ProfileClientProps) {
  const t = useTranslations("ProfilePage");
  const { user, roles } = useUserStoreV2();
  const { data: preferences, isLoading } = usePreferencesQuery();
  const updateProfile = useUpdateProfileMutation();

  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  // Initialize form values from preferences once loaded
  useEffect(() => {
    if (preferences) {
      setDisplayName(preferences.displayName ?? "");
      setPhone(preferences.phone ?? "");
    }
  }, [preferences?.displayName, preferences?.phone]);

  if (isLoading) {
    return <LoadingSkeleton variant="form" count={2} />;
  }

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.first_name) return user.first_name[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "U";
  };

  const handleSave = () => {
    updateProfile.mutate({
      displayName: displayName || null,
      phone: phone || null,
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{translations.description}</p>
      <div className="grid gap-6 max-w-2xl">
        {/* Profile Edit */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription>{translations.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar_url ?? undefined} alt="Avatar" />
                <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("displayNamePlaceholder")}
                maxLength={100}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                maxLength={20}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input value={user?.email ?? ""} disabled className="bg-muted" />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t("saving") : t("save")}
            </Button>
          </CardFooter>
        </Card>

        {/* Account Info (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("accountInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("accountId")}</span>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="truncate max-w-[180px]">{user?.id}</span>
                  <CopyToClipboard text={user?.id ?? ""} variant="icon" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("email")}</span>
                <span>{user?.email}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("roles")}</span>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {roles.map((role, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {role.role}
                    </Badge>
                  ))}
                  {roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
