"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

type Props = {
  logoUrl?: string | null;
  organizationId: string;
};

export default function OrganizationLogoUploader({ logoUrl, organizationId }: Props) {
  const [preview, setPreview] = useState<string | null>(logoUrl || null);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  const updateOrganizationLogoUrl = async (url: string) => {
    const { error } = await supabase
      .from("organization_profiles")
      .update({ logo_url: url })
      .eq("organization_id", organizationId);

    if (error) {
      toast.error("❌ Nie udało się zaktualizować logo w bazie.");
      return false;
    }

    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${organizationId}.${fileExt}`;
    const filePath = fileName;

    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from("organization-logos")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      toast.error(`❌ Błąd podczas wgrywania logo: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("organization-logos").getPublicUrl(filePath);

    const success = await updateOrganizationLogoUrl(publicUrl);

    if (success) {
      setPreview(publicUrl);
      toast.success("✅ Logo zaktualizowane.");
    }

    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {preview && (
        <div className="relative h-32 w-32 rounded border bg-white">
          <Image src={preview} alt="Logo organizacji" fill className="object-contain" />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-sm"
      />
      <Button type="button" variant="themed" disabled={uploading}>
        {uploading ? "Wgrywam..." : "Zmień logo"}
      </Button>
    </div>
  );
}
