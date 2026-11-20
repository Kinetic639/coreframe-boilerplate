import { compressImageFile, prepareImage } from "@/lib/media/image-compress";
import { imageVariantPath } from "@/lib/media/image-variant-paths";
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
    // Screenshots and photos are shrunk to 2048 px WebP, with a 640 px version
    // for the preview in the report; other files go as picked.
    const prepared =
      file.type === "image/gif"
        ? null
        : await prepareImage(file, { variants: ["card"] }).catch(() => null);
    const upload = prepared?.file ?? (await compressImageFile(file));
    const path = `${feedbackId}/${crypto.randomUUID()}${extensionOf(upload.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, upload, { contentType: upload.type, upsert: false, cacheControl: "31536000" });
    if (error) {
      rejected.push(file.name);
      continue;
    }
    for (const variant of prepared?.variants ?? []) {
      // The preview is optional: the report shows the full image without it.
      await supabase.storage
        .from(BUCKET)
        .upload(imageVariantPath(path, variant.name, variant.blob.type), variant.blob, {
          contentType: variant.blob.type,
          upsert: false,
          cacheControl: "31536000",
        });
    }
    uploaded.push({ path, name: upload.name, type: upload.type, size: upload.size });
  }
  return { uploaded, rejected };
}
