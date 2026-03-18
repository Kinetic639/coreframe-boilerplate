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

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("❌ Plik jest za duży. Maksymalny rozmiar to 2MB.");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("❌ Nieprawidłowy typ pliku. Wybierz obraz.");
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${organizationId}.${fileExt}`;
    const filePath = fileName;

    console.log("🔍 Uploading logo:", {
      organizationId,
      fileName,
      filePath,
      fileSize: file.size,
      fileType: file.type,
    });

    setUploading(true);

    try {
      // Clear any previous uploads with same organization ID
      const { error: deleteError } = await supabase.storage
        .from("organization-logos")
        .remove([filePath]);

      if (deleteError && deleteError.message !== "Not found") {
        console.warn("⚠️ Could not delete existing file:", deleteError);
      }

      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      // console.log("🔍 Upload response:", { uploadData, uploadError });

      if (uploadError) {
        console.error("❌ Upload error details:", {
          message: uploadError.message,
          cause: uploadError.cause,
          statusCode: (uploadError as any).statusCode,
          filePath: filePath,
        });
        toast.error(`❌ Błąd podczas wgrywania logo: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      // console.log("✅ Upload successful");

      const {
        data: { publicUrl },
      } = supabase.storage.from("organization-logos").getPublicUrl(filePath);

      // console.log("🔍 Generated public URL:", publicUrl);

      const success = await updateOrganizationLogoUrl(publicUrl);

      if (success) {
        setPreview(publicUrl);
        toast.success("✅ Logo zaktualizowane.");
        // Force reload of the page to refresh the sidebar logo
        window.location.reload();
      }
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      toast.error("❌ Wystąpił nieoczekiwany błąd.");
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
      <Button type="button" disabled={uploading}>
        {uploading ? "Wgrywam..." : "Zmień logo"}
      </Button>
    </div>
  );
}
