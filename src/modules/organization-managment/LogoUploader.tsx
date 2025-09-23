"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import { uploadOrganizationLogo } from "./api/uploadLogo";

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("❌ Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("❌ File size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      // Use server action for upload with proper authorization
      const formData = new FormData();
      formData.append("file", file);
      formData.append("organizationId", organizationId);

      const result = await uploadOrganizationLogo(formData);

      if (result.error) {
        toast.error(`❌ ${result.error.message}`);
        return;
      }

      if (result.success && result.url) {
        onUpload(result.url);
        toast.success("✅ Logo zaktualizowane");
      }
    } catch (error) {
      toast.error(
        `❌ Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Logo Display */}
      {currentUrl ? (
        <div className="relative h-32 w-32 rounded-lg border bg-white p-2">
          <Image src={currentUrl} alt="Current Logo" fill className="object-contain" />
        </div>
      ) : (
        <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed bg-gray-50">
          <p className="text-sm text-gray-500">No logo</p>
        </div>
      )}

      {/* File Input */}
      <div className="space-y-2">
        <label className="block">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
        </label>

        <p className="text-xs text-gray-500">
          Supported formats: PNG, JPEG, GIF, WebP. Max size: 5MB.
        </p>

        {uploading && <div className="text-sm text-blue-600">⏳ Uploading logo...</div>}
      </div>
    </div>
  );
}
