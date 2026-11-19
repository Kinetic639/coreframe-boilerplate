import { compressImageFile } from "@/lib/media/image-compress";
import { createClient } from "@/utils/supabase/client";
import { FEEDBACK_MAX_FILES, isAllowedFeedbackFile, type UploadedFeedbackFile } from "./types";

const BUCKET = "platform-feedback";

function extensionOf(name: string): string {
  const match = /\.([a-zA-Z0-9]{1,12})$/.exec(name.trim());
  return match ? `.${match[1].toLowerCase()}` : "";
}

/**
 * Uploads files from the browser straight into "platform-feedback/<report id>/"
 * (no server hop, so screenshots and recordings are not cut by the function
 * body limit). The storage policy lets only people with access to the report
 * write into its folder. Returns what landed and what did not.
 */
export async function uploadFeedbackFiles(
  feedbackId: string,
  files: File[]
): Promise<{ uploaded: UploadedFeedbackFile[]; rejected: string[] }> {
  const supabase = createClient();
  const uploaded: UploadedFeedbackFile[] = [];
  const rejected: string[] = [];
  for (const file of files.slice(0, FEEDBACK_MAX_FILES)) {
    if (!isAllowedFeedbackFile(file)) {
      rejected.push(file.name);
      continue;
    }
    // Screenshots and photos are shrunk to 2048 px WebP; other files go as picked.
    const upload = await compressImageFile(file);
    const path = `${feedbackId}/${crypto.randomUUID()}${extensionOf(upload.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, upload, { contentType: upload.type, upsert: false, cacheControl: "31536000" });
    if (error) {
      rejected.push(file.name);
      continue;
    }
    uploaded.push({ path, name: upload.name, type: upload.type, size: upload.size });
  }
  return { uploaded, rejected };
}
