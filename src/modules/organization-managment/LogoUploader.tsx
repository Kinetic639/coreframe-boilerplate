"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { Upload } from "lucide-react";

export default function LogoUploader({
  organizationId,
  currentUrl,
  onUpload,
}: {
  organizationId: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop();
    const filePath = `${organizationId}.${ext}`;

    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from("organization-logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(`❌ Upload error: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("organization-logos").getPublicUrl(filePath);

    onUpload(publicUrl);
    toast.success("Logo zaktualizowane");
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {currentUrl && (
        <div className="relative h-20 w-20 rounded border bg-white">
          <Image src={currentUrl} alt="Logo" fill className="object-contain" />
        </div>
      )}
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      <Button type="button" variant="outline" disabled={uploading}>
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Wgrywanie..." : "Wgraj logo"}
      </Button>
    </div>
  );
}
