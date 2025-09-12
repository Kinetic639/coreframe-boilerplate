"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useChatList } from "@/lib/stores/chat-store";
import { useAppStore } from "@/lib/stores/app-store";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

interface SendMessageButtonProps {
  userId: string;
  userName: string;
  className?: string;
  variant?: "outline" | "default" | "secondary" | "ghost" | "link" | "destructive";
  size?: "sm" | "default" | "lg";
}

export function SendMessageButton({
  userId,
  userName,
  className,
  variant = "outline",
  size = "sm",
}: SendMessageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { createDirectChat } = useChatList();
  const { activeOrgId, activeBranchId } = useAppStore();
  const router = useRouter();
  const t = useTranslations("teams.communication");

  const handleSendMessage = async () => {
    if (!activeOrgId || !activeBranchId) {
      toast.error(t("errors.selectOrgBranch"));
      return;
    }

    try {
      setIsLoading(true);

      // Create or get existing direct chat
      const chat = await createDirectChat(userId, activeOrgId, activeBranchId);

      // Navigate to the chat
      router.push(`/dashboard/teams/communication/chat/${chat.id}`);

      toast.success(t("success.conversationStarted", { userName }));
    } catch (error) {
      console.error("Error starting conversation:", error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("not set up yet") || error.message.includes("not available")) {
          toast.error(t("errors.systemNotAvailable"));
        } else if (error.message.includes("Failed to create chat")) {
          toast.error(t("errors.createChatFailed"));
        } else {
          toast.error(t("errors.conversationFailedContact"));
        }
      } else {
        toast.error(t("errors.conversationFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleSendMessage}
      disabled={isLoading}
      title={t("sendMessage")}
    >
      {size === "sm" ? (
        <MessageSquare className="h-4 w-4" />
      ) : (
        <>
          <MessageSquare className="mr-2 h-4 w-4" />
          {isLoading ? t("startingConversation") : t("sendMessage")}
        </>
      )}
    </Button>
  );
}
