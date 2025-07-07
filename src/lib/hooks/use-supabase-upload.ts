import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export const useSupabaseUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const uploadFile = async (
    bucketName: string,
    file: File,
    path: string
  ): Promise<string | null> => {
    setIsUploading(true);
    setError(null);

    try {
      console.log(
        "Attempting to upload file:",
        file.name,
        "to bucket:",
        bucketName,
        "at path:",
        path
      );
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", JSON.stringify(uploadError, null, 2));
        throw uploadError;
      }

      console.log("File uploaded successfully, data:", data);
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);
      console.log("Public URL data:", publicUrlData);

      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.error("Error in useSupabaseUpload:", err);
      setError(err.message);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, error };
};
