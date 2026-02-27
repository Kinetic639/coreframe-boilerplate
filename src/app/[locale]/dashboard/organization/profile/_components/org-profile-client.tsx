"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Upload, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  useOrgProfileQuery,
  useUpdateOrgProfileMutation,
  useUploadOrgLogoMutation,
} from "@/hooks/queries/organization";
import type { OrgProfileData } from "@/server/services/organization.service";

interface OrgProfileClientProps {
  canEdit: boolean;
  initialProfile: OrgProfileData | null;
}

export function OrgProfileClient({ canEdit, initialProfile }: OrgProfileClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useOrgProfileQuery(initialProfile);
  const updateProfileMutation = useUpdateOrgProfileMutation();
  const uploadLogoMutation = useUploadOrgLogoMutation();

  const isPending = updateProfileMutation.isPending || uploadLogoMutation.isPending;

  const [name, setName] = useState(initialProfile?.name ?? "");
  const [name2, setName2] = useState(initialProfile?.name_2 ?? "");
  const [slug, setSlug] = useState(initialProfile?.slug ?? "");
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [website, setWebsite] = useState(initialProfile?.website ?? "");

  const handleSave = () => {
    updateProfileMutation.mutate(
      { name, name_2: name2, slug, bio, website },
      { onSuccess: () => router.refresh() }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    uploadLogoMutation.mutate(formData, { onSuccess: () => router.refresh() });
  };

  const handleRemoveLogo = () => {
    updateProfileMutation.mutate({ logo_url: null }, { onSuccess: () => router.refresh() });
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-md">
              <AvatarImage src={profile?.logo_url ?? undefined} alt="Logo" />
              <AvatarFallback className="rounded-md text-lg">
                {name.charAt(0).toUpperCase() || "O"}
              </AvatarFallback>
            </Avatar>
            {canEdit && (
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {profile?.logo_url ? "Change Logo" : "Upload Logo"}
                </Button>
                {profile?.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Max 5 MB. JPG, PNG, WebP, GIF.</p>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your organization name"
              maxLength={200}
              disabled={!canEdit || isPending}
            />
          </div>

          {/* Name 2 */}
          <div className="space-y-2">
            <Label htmlFor="name2">Secondary Name</Label>
            <Input
              id="name2"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder="Legal name or trade name"
              maxLength={200}
              disabled={!canEdit || isPending}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-organization"
              maxLength={100}
              disabled={!canEdit || isPending}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, hyphens only.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Description</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your organization"
              maxLength={500}
              rows={3}
              disabled={!canEdit || isPending}
            />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              disabled={!canEdit || isPending}
            />
          </div>
        </CardContent>
        {canEdit && (
          <CardFooter>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
