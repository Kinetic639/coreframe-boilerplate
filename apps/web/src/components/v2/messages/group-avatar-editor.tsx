"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { removeGroupAvatarAction, setGroupAvatarAction } from "@/app/actions/messages";
import { AvatarCropDialog } from "@/components/v2/media/avatar-crop-dialog";
import { messagesKeys } from "@/hooks/queries/messages";
import { CHAT_GROUP_AVATAR_MAX_BYTES, type ChatErrorCode } from "@/lib/messages/types";
import { useChat } from "./chat-provider";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
/** Larger originals are fine: the crop dialog scales them down to 512 px */
const PICK_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Setting the group photo (owner or creator): pick a file, frame it in the
 * same crop dialog as the profile photo, upload. Returns `pick` / `remove`
 * and the elements (hidden file input, crop dialog) to render once.
 */
export function useGroupAvatarEditor(conversationId: string) {
  const t = useTranslations("chat");
  const { orgId } = useChat();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversation(conversationId) });
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
  };

  const fail = (error: ChatErrorCode) => {
    if (error === "invalid") toast.error(t("page.photoInvalid"));
    else if (error === "tooLong") toast.error(t("page.photoTooLarge"));
    else toast.error(t(`errors.${error}`));
  };

  const upload = (file: File) => {
    setCropFile(null);
    if (file.size > CHAT_GROUP_AVATAR_MAX_BYTES) {
      toast.error(t("page.photoTooLarge"));
      return;
    }
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("file", file);
    startTransition(async () => {
      const result = await setGroupAvatarAction(formData);
      if (!result.success) return fail((result as { error: ChatErrorCode }).error);
      toast.success(t("page.photoSaved"));
      refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await removeGroupAvatarAction({ conversationId });
      if (!result.success) return fail((result as { error: ChatErrorCode }).error);
      toast.success(t("page.photoRemoved"));
      refresh();
    });

  const elements = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        data-testid="group-avatar-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // The same file can be picked again later
          event.target.value = "";
          if (!file) return;
          if (!ACCEPT.split(",").includes(file.type)) {
            toast.error(t("page.photoInvalid"));
            return;
          }
          if (file.size > PICK_MAX_BYTES) {
            toast.error(t("page.photoTooLarge"));
            return;
          }
          setCropFile(file);
        }}
      />
      <AvatarCropDialog file={cropFile} onCancel={() => setCropFile(null)} onConfirm={upload} />
    </>
  );

  return { pick: () => inputRef.current?.click(), remove, pending, elements };
}
