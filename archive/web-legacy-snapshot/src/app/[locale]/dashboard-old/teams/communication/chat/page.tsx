"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import ChatList from "@/components/chat/ChatList";
import { MessageCircle, Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatUI } from "@/lib/stores/chat-store";
import { useRouter } from "@/i18n/navigation";

export default function ChatPage() {
  const t = useTranslations();
  const router = useRouter();
  const { setCurrentView } = useChatUI();

  // Set view to list since no chat is selected
  React.useEffect(() => {
    setCurrentView("list");
  }, [setCurrentView]);

  const handleChatSelect = (chatId: string) => {
    // Navigate to the chat-specific URL
    router.push({
      pathname: "/dashboard-old/teams/communication/chat/[chatId]",
      params: { chatId },
    });
  };

  const EmptyState = () => (
    <div className="flex flex-1 items-center justify-center bg-muted/20">
      <div className="max-w-md px-4 text-center">
        <MessageCircle className="mx-auto mb-6 h-16 w-16 text-muted-foreground/50" />
        <h2 className="mb-3 text-xl font-semibold">{t("teams.communication.welcomeToChat")}</h2>
        <p className="mb-6 text-muted-foreground">{t("teams.communication.selectChatToStart")}</p>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            <span>{t("teams.communication.instantMessaging")}</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span>{t("teams.communication.directMessages")}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full">
      <Card className="h-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Chat List Panel */}
          <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
            <ChatList
              selectedChatId={null}
              onChatSelect={handleChatSelect}
              className="h-full border-r"
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Chat Interface Panel */}
          <ResizablePanel defaultSize={70}>
            <EmptyState />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
    </div>
  );
}
