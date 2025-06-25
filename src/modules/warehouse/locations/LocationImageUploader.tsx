"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { createClient } from "@/utils/supabase/client";

interface Props {
  imageUrl?: string | null;
  locationId: string;
}

export default function LocationImageUploader({ imageUrl, locationId }: Props) {
  const [preview, setPreview] = useState<string | null>(imageUrl || null);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  const updateLocationImageUrl = async (url: string) => {
    const { error } = await supabase
      .from("warehouse_locations")
      .update({ image_url: url })
      .eq("id", locationId);

    if (error) {
      toast.error("❌ Nie udało się zaktualizować zdjęcia.");
      return false;
    }

    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${locationId}.${fileExt}`;
    const filePath = fileName;

    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from("location-images")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(`❌ Błąd podczas wgrywania zdjęcia: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("location-images").getPublicUrl(filePath);

    const success = await updateLocationImageUrl(publicUrl);

    if (success) {
      setPreview(publicUrl);
      toast.success("✅ Zdjęcie zaktualizowane.");
    }

    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {preview && (
        <div className="relative h-32 w-32 rounded border bg-white">
          <Image src={preview} alt="Zdjęcie lokalizacji" fill className="object-contain" />
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
        {uploading ? "Wgrywam..." : "Zmień zdjęcie"}
      </Button>
    </div>
  );
}
