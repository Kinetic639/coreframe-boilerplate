"use client";

import { useState, useEffect, useRef, useTransition } from "react";
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
import { User, Shield, Upload, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "@/i18n/navigation";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { usePreferencesQuery, useUpdateProfileMutation } from "@/hooks/queries/user-preferences";
import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";
import { CopyToClipboard } from "@/components/v2/utility/copy-to-clipboard";
import { uploadAvatarAction, removeAvatarAction } from "@/app/actions/user-preferences";

interface ProfileClientProps {
  avatarSignedUrl: string | null;
  translations: {
    description: string;
  };
}

export function ProfileClient({ avatarSignedUrl, translations }: ProfileClientProps) {
  const t = useTranslations("ProfilePage");
  const { user, roles } = useUserStoreV2();
  const { data: preferences, isLoading } = usePreferencesQuery();
  const updateProfile = useUpdateProfileMutation();
  const router = useRouter();

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [isPendingAvatar, startAvatarTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize names from user store
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
    }
  }, [user?.first_name, user?.last_name]);

  // Initialize display name and phone from preferences once loaded
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
    updateProfile.mutate(
      {
        firstName: firstName || null,
        lastName: lastName || null,
        displayName: displayName || null,
        phone: phone || null,
      },
      { onSuccess: () => router.refresh() }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected after removal
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    startAvatarTransition(async () => {
      const result = await uploadAvatarAction(formData);
      if (result.success) {
        toast.success("Avatar updated successfully.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to upload avatar.");
      }
    });
  };

  const handleRemoveAvatar = () => {
    startAvatarTransition(async () => {
      const result = await removeAvatarAction();
      if (result.success) {
        toast.success("Avatar removed.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to remove avatar.");
      }
    });
  };

  // Prefer signed URL (uploaded avatar) over OAuth avatar_url; fall back to initials
  const avatarSrc = avatarSignedUrl ?? user?.avatar_url ?? undefined;

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
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarSrc} alt="Avatar" />
                  <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
                </Avatar>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-medium">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>

                {/* Avatar actions */}
                <div className="flex items-center gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isPendingAvatar}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPendingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {isPendingAvatar ? "Uploading…" : avatarSignedUrl ? "Change" : "Upload"}
                  </Button>
                  {avatarSignedUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPendingAvatar}
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Max 5 MB. JPG, PNG, WebP, GIF.</p>
              </div>
            </div>

            <Separator />

            {/* First & Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("firstName")}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("firstNamePlaceholder")}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("lastNamePlaceholder")}
                  maxLength={100}
                />
              </div>
            </div>

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
