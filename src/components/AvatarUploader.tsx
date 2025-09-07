"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-toastify";
import { createClient } from "@/utils/supabase/client";
import { Camera, Upload } from "lucide-react";

type Props = {
  avatarUrl?: string | null;
  userId: string;
  userInitials: string;
  onAvatarUpdate?: (newUrl: string) => void;
};

export default function AvatarUploader({ avatarUrl, userId, userInitials, onAvatarUpdate }: Props) {
  const [preview, setPreview] = useState<string | null>(avatarUrl || null);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  const updateUserAvatarUrl = async (url: string) => {
    const { error } = await supabase
      .from("public.users")
      .update({ avatar_url: url })
      .eq("id", userId);

    if (error) {
      console.error("❌ Database update error:", error);
      console.error("❌ Database error message:", error.message);
      console.error("❌ Full database error:", JSON.stringify(error, null, 2));
      toast.error(`❌ Failed to update avatar in database: ${error.message}`);
      return false;
    }

    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Debug: Check authentication status
    const { data: session } = await supabase.auth.getSession();
    console.warn("🔍 Auth session:", session);
    console.warn("🔍 User ID:", session.session?.user?.id);
    console.warn("🔍 User role:", session.session?.user?.role);

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("❌ File is too large. Maximum size is 2MB.");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("❌ Invalid file type. Please select an image.");
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `avatar.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    setUploading(true);

    try {
      // Clear any previous uploads for this user
      const { error: deleteError } = await supabase.storage.from("user-avatars").remove([filePath]);

      if (deleteError && deleteError.message !== "Not found") {
        console.warn("⚠️ Could not delete existing file:", deleteError);
      }

      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("❌ Upload error details:", uploadError);
        console.error("❌ Upload error message:", uploadError.message);
        console.error("❌ Upload error cause:", uploadError.cause);
        console.error("❌ Full error object:", JSON.stringify(uploadError, null, 2));
        toast.error(`❌ Error uploading avatar: ${uploadError.message || "Unknown error"}`);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-avatars").getPublicUrl(filePath);

      const success = await updateUserAvatarUrl(publicUrl);

      if (success) {
        setPreview(publicUrl);
        toast.success("✅ Avatar updated successfully.");

        // Call the callback to update parent component
        if (onAvatarUpdate) {
          onAvatarUpdate(publicUrl);
        }
      }
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      toast.error("❌ An unexpected error occurred.");
    }

    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="group relative">
        <Avatar className="h-32 w-32">
          <AvatarImage src={preview || undefined} alt="User avatar" />
          <AvatarFallback className="bg-muted text-2xl font-semibold">
            {userInitials}
          </AvatarFallback>
        </Avatar>

        {/* Overlay for camera icon on hover */}
        <div className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black bg-opacity-50 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-8 w-8 text-white" />
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          title="Click to upload avatar"
        />
      </div>

      <div className="flex flex-col items-center space-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => {
            const fileInput = document.querySelector(
              'input[type="file"][accept="image/*"]'
            ) as HTMLInputElement;
            fileInput?.click();
          }}
          className="relative"
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading..." : "Change Avatar"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Max 2MB. JPG, PNG, GIF supported.
        </p>
      </div>
    </div>
  );
}
