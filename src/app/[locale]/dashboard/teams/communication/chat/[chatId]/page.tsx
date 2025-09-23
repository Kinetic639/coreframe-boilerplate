"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import ChatList from "@/components/chat/ChatList";
import ChatInterface from "@/components/chat/ChatInterface";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useChatUI } from "@/lib/stores/chat-store";

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const { setCurrentView } = useChatUI();

  // Set view to chat
  React.useEffect(() => {
    setCurrentView("chat");
  }, [setCurrentView]);

  const handleChatSelect = (newChatId: string) => {
    // This will be handled by navigation
    if (newChatId !== chatId) {
      router.push({
        pathname: "/dashboard/teams/communication/chat/[chatId]",
        params: { chatId: newChatId },
      });
    }
  };

  return (
    <div className="h-full w-full">
      <Card className="h-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Chat List Panel */}
          <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
            <ChatList
              selectedChatId={chatId}
              onChatSelect={handleChatSelect}
              className="h-full border-r"
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Chat Interface Panel */}
          <ResizablePanel defaultSize={70}>
            <ChatInterface chatId={chatId} className="h-full" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
    </div>
  );
}
