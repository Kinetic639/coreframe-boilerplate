import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Types for our chat system
export interface ChatUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
}

export interface Chat {
  id: string;
  name?: string;
  type: "direct" | "group";
  organization_id: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_message_at?: string;
  is_active: boolean;
  participants: ChatUser[];
  last_message?: Message;
  unread_count: number;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  organization_id: string;
  branch_id: string;
  content: string;
  content_type: "text" | "image" | "file" | "system";
  message_type: "message" | "system" | "notification";
  reply_to_message_id?: string;
  edited_at?: string;
  deleted_at?: string;
  created_at: string;
  lexical_state?: any; // Lexical editor state
  sender: ChatUser;
  reply_to_message?: Message;
  status?: MessageStatus[];
}

export interface MessageStatus {
  id: string;
  message_id: string;
  user_id: string;
  status: "sent" | "delivered" | "read";
  status_at: string;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  organization_id: string;
  branch_id: string;
  joined_at: string;
  left_at?: string;
  is_admin: boolean;
  user: ChatUser;
}

// Store slices
interface ChatListSlice {
  chats: Chat[];
  selectedChatId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  selectChat: (chatId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // API methods
  loadChats: (orgId: string, branchId: string) => Promise<void>;
  createDirectChat: (otherUserId: string, orgId: string, branchId: string) => Promise<Chat>;
}

interface MessagesSlice {
  messagesByChat: Record<string, Message[]>;
  isLoadingMessages: boolean;
  messagesError: string | null;

  // Actions
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  setMessagesLoading: (loading: boolean) => void;
  setMessagesError: (error: string | null) => void;

  // API methods
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (
    chatId: string,
    content: string,
    lexicalState?: any,
    replyToMessageId?: string
  ) => Promise<void>;
  markMessageAsRead: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string, lexicalState?: any) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

interface RealtimeSlice {
  channels: Record<string, RealtimeChannel>;
  isConnected: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  subscribeToChat: (chatId: string) => void;
  unsubscribeFromChat: (chatId: string) => void;
  subscribeToUserChats: (userId: string) => void;
  unsubscribeFromUserChats: (userId: string) => void;
  cleanup: () => void;
}

interface UISlice {
  isMessagesDrawerOpen: boolean;
  isChatListOpen: boolean;
  currentView: "list" | "chat" | "empty";
  searchQuery: string;

  // Actions
  setMessagesDrawerOpen: (open: boolean) => void;
  setChatListOpen: (open: boolean) => void;
  setCurrentView: (view: "list" | "chat" | "empty") => void;
  setSearchQuery: (query: string) => void;
  toggleMessagesDrawer: () => void;
}

// Combine all slices
type ChatStore = ChatListSlice & MessagesSlice & RealtimeSlice & UISlice;

// Create the chat list slice
const createChatListSlice: StateCreator<ChatStore, [], [], ChatListSlice> = (set, get) => ({
  chats: [],
  selectedChatId: null,
  isLoading: false,
  error: null,

  setChats: (chats) => set({ chats }),
  addChat: (chat) =>
    set((state) => ({
      chats: [chat, ...state.chats.filter((c) => c.id !== chat.id)],
    })),
  updateChat: (chatId, updates) =>
    set((state) => ({
      chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, ...updates } : chat)),
    })),
  removeChat: (chatId) =>
    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== chatId),
    })),
  selectChat: (chatId) => set({ selectedChatId: chatId }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  loadChats: async (orgId, branchId) => {
    const { setLoading, setError, setChats } = get();

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Load chats with participants and last message
      const { data: chatsData, error: chatsError } = await supabase
        .from("chats")
        .select(
          `
          *,
          chat_participants!inner (
            user_id,
            users!chat_participants_user_id_fkey (
              id,
              first_name,
              last_name,
              email,
              avatar_url
            )
          ),
          messages (
            id,
            content,
            created_at,
            sender_id,
            content_type,
            users!messages_sender_id_fkey (
              first_name,
              last_name
            )
          )
        `
        )
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (chatsError) {
        console.error("Error loading chats:", chatsError);
        throw new Error(`Failed to load chats: ${chatsError.message}`);
      }

      // Process chats data
      const processedChats: Chat[] = (chatsData || []).map((chat) => ({
        ...chat,
        participants: chat.chat_participants.map((p: any) => p.users),
        last_message: chat.messages?.[0],
        unread_count: 0, // TODO: Calculate unread count
      }));

      setChats(processedChats);
    } catch (error) {
      console.error("Error loading chats:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load chats";
      setError(errorMessage);
      setChats([]);
    } finally {
      setLoading(false);
    }
  },

  createDirectChat: async (otherUserId, orgId, branchId) => {
    const supabase = createClient();

    try {
      const { data: chatId, error } = await supabase.rpc("create_direct_chat", {
        other_user_id: otherUserId,
        org_id: orgId,
        br_id: branchId,
      });

      if (error) {
        console.error("Error creating direct chat:", error);
        throw new Error(`Failed to create chat: ${error.message}`);
      }

      // Reload chats to get the new chat
      await get().loadChats(orgId, branchId);

      const newChat = get().chats.find((c) => c.id === chatId);
      if (!newChat) {
        throw new Error("Created chat not found after reload");
      }

      return newChat;
    } catch (error) {
      console.error("Error creating direct chat:", error);
      throw error;
    }
  },
});

// Create the messages slice
const createMessagesSlice: StateCreator<ChatStore, [], [], MessagesSlice> = (set, get) => ({
  messagesByChat: {},
  isLoadingMessages: false,
  messagesError: null,

  setMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: messages,
      },
    })),
  addMessage: (message) =>
    set((state) => ({
      messagesByChat: {
        ...state.messagesByChat,
        [message.chat_id]: [...(state.messagesByChat[message.chat_id] || []), message].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      },
    })),
  updateMessage: (messageId, updates) =>
    set((state) => {
      const newMessagesByChat = { ...state.messagesByChat };

      Object.keys(newMessagesByChat).forEach((chatId) => {
        newMessagesByChat[chatId] = newMessagesByChat[chatId].map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
      });

      return { messagesByChat: newMessagesByChat };
    }),
  removeMessage: (messageId) =>
    set((state) => {
      const newMessagesByChat = { ...state.messagesByChat };

      Object.keys(newMessagesByChat).forEach((chatId) => {
        newMessagesByChat[chatId] = newMessagesByChat[chatId].filter((msg) => msg.id !== messageId);
      });

      return { messagesByChat: newMessagesByChat };
    }),
  setMessagesLoading: (loading) => set({ isLoadingMessages: loading }),
  setMessagesError: (error) => set({ messagesError: error }),

  loadMessages: async (chatId) => {
    const { setMessagesLoading, setMessagesError, setMessages } = get();

    try {
      setMessagesLoading(true);
      setMessagesError(null);

      const supabase = createClient();

      const { data: messagesData, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:users!messages_sender_id_fkey (
            id,
            first_name,
            last_name,
            email,
            avatar_url
          ),
          reply_to_message:messages!reply_to_message_id (
            id,
            content,
            sender:users!messages_sender_id_fkey (
              first_name,
              last_name
            )
          ),
          message_status (
            status,
            status_at,
            user_id
          )
        `
        )
        .eq("chat_id", chatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        throw new Error(`Failed to load messages: ${error.message}`);
      }

      const processedMessages: Message[] = (messagesData || []).map((msg) => ({
        ...msg,
        sender: msg.sender,
        reply_to_message: msg.reply_to_message,
        status: msg.message_status || [],
      }));

      setMessages(chatId, processedMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load messages";
      setMessagesError(errorMessage);
    } finally {
      setMessagesLoading(false);
    }
  },

  sendMessage: async (chatId, content, lexicalState, replyToMessageId) => {
    const supabase = createClient();

    try {
      const { data: messageId, error } = await supabase.rpc("send_message", {
        p_chat_id: chatId,
        p_content: content,
        p_content_type: "text",
        p_lexical_state: lexicalState,
        p_reply_to_message_id: replyToMessageId,
      });

      if (error) {
        console.error("Error sending message:", error);
        throw new Error(`Failed to send message: ${error.message}`);
      }

      // Reload messages to ensure consistency and get the new message with full data
      await get().loadMessages(chatId);

      return messageId;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },

  markMessageAsRead: async (messageId) => {
    const supabase = createClient();

    const { error } = await supabase.rpc("mark_message_read", {
      p_message_id: messageId,
    });

    if (error) throw error;
  },

  editMessage: async (messageId, content, lexicalState) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("messages")
      .update({
        content,
        lexical_state: lexicalState,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    if (error) throw error;
  },

  deleteMessage: async (messageId) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("messages")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    if (error) throw error;
  },
});

// Create the realtime slice
const createRealtimeSlice: StateCreator<ChatStore, [], [], RealtimeSlice> = (set, get) => ({
  channels: {},
  isConnected: false,

  setConnected: (connected) => set({ isConnected: connected }),

  subscribeToChat: (chatId) => {
    const supabase = createClient();
    const { channels } = get();

    // Don't subscribe if already subscribed
    if (channels[chatId]) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          // Handle new message
          console.warn("New message:", payload);
          // We'll need to fetch the full message with sender info
          get().loadMessages(chatId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.warn("Message updated:", payload);
          get().loadMessages(chatId);
        }
      )
      .subscribe();

    set((state) => ({
      channels: { ...state.channels, [chatId]: channel },
    }));
  },

  unsubscribeFromChat: (chatId) => {
    const { channels } = get();
    const channel = channels[chatId];

    if (channel) {
      channel.unsubscribe();

      set((state) => {
        const newChannels = { ...state.channels };
        delete newChannels[chatId];
        return { channels: newChannels };
      });
    }
  },

  subscribeToUserChats: (userId) => {
    const supabase = createClient();
    const { channels } = get();

    const channelKey = `user-chats:${userId}`;
    if (channels[channelKey]) return;

    const channel = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        (payload) => {
          console.warn("Chat updated:", payload);
          // Reload chats when changes occur
          // We'll need org and branch context for this
        }
      )
      .subscribe();

    set((state) => ({
      channels: { ...state.channels, [channelKey]: channel },
    }));
  },

  unsubscribeFromUserChats: (userId) => {
    const { channels } = get();
    const channelKey = `user-chats:${userId}`;
    const channel = channels[channelKey];

    if (channel) {
      channel.unsubscribe();

      set((state) => {
        const newChannels = { ...state.channels };
        delete newChannels[channelKey];
        return { channels: newChannels };
      });
    }
  },

  cleanup: () => {
    const { channels } = get();

    Object.values(channels).forEach((channel) => {
      channel.unsubscribe();
    });

    set({ channels: {}, isConnected: false });
  },
});

// Create the UI slice
const createUISlice: StateCreator<ChatStore, [], [], UISlice> = (set, _get) => ({
  isMessagesDrawerOpen: false,
  isChatListOpen: false,
  currentView: "list",
  searchQuery: "",

  setMessagesDrawerOpen: (open) => set({ isMessagesDrawerOpen: open }),
  setChatListOpen: (open) => set({ isChatListOpen: open }),
  setCurrentView: (view) => set({ currentView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleMessagesDrawer: () =>
    set((state) => ({
      isMessagesDrawerOpen: !state.isMessagesDrawerOpen,
    })),
});

// Create the combined store
export const useChatStore = create<ChatStore>()(
  devtools(
    persist(
      (...a) => ({
        ...createChatListSlice(...a),
        ...createMessagesSlice(...a),
        ...createRealtimeSlice(...a),
        ...createUISlice(...a),
      }),
      {
        name: "chat-store",
        // Only persist UI state
        partialize: (state) => ({
          isMessagesDrawerOpen: state.isMessagesDrawerOpen,
          currentView: state.currentView,
        }),
      }
    ),
    { name: "ChatStore" }
  )
);

// Export selectors for better performance
export const useChatList = () =>
  useChatStore(
    useShallow((state) => ({
      chats: state.chats,
      selectedChatId: state.selectedChatId,
      isLoading: state.isLoading,
      error: state.error,
      selectChat: state.selectChat,
      loadChats: state.loadChats,
      createDirectChat: state.createDirectChat,
    }))
  );

export const useMessages = () =>
  useChatStore(
    useShallow((state) => ({
      messagesByChat: state.messagesByChat,
      isLoadingMessages: state.isLoadingMessages,
      messagesError: state.messagesError,
      loadMessages: state.loadMessages,
      sendMessage: state.sendMessage,
      markMessageAsRead: state.markMessageAsRead,
      editMessage: state.editMessage,
      deleteMessage: state.deleteMessage,
    }))
  );

export const useChatRealtime = () =>
  useChatStore(
    useShallow((state) => ({
      isConnected: state.isConnected,
      subscribeToChat: state.subscribeToChat,
      unsubscribeFromChat: state.unsubscribeFromChat,
      subscribeToUserChats: state.subscribeToUserChats,
      unsubscribeFromUserChats: state.unsubscribeFromUserChats,
      cleanup: state.cleanup,
    }))
  );

// Individual selectors to prevent object recreation
export const useMessagesDrawerOpen = () => useChatStore((state) => state.isMessagesDrawerOpen);
export const useChatListOpen = () => useChatStore((state) => state.isChatListOpen);
export const useCurrentView = () => useChatStore((state) => state.currentView);
export const useSearchQuery = () => useChatStore((state) => state.searchQuery);

// Action selectors
export const useSetMessagesDrawerOpen = () => useChatStore((state) => state.setMessagesDrawerOpen);
export const useSetChatListOpen = () => useChatStore((state) => state.setChatListOpen);
export const useSetCurrentView = () => useChatStore((state) => state.setCurrentView);
export const useSetSearchQuery = () => useChatStore((state) => state.setSearchQuery);
export const useToggleMessagesDrawer = () => useChatStore((state) => state.toggleMessagesDrawer);

// Combined hook for convenience with shallow comparison
export const useChatUI = () =>
  useChatStore(
    useShallow((state) => ({
      isMessagesDrawerOpen: state.isMessagesDrawerOpen,
      isChatListOpen: state.isChatListOpen,
      currentView: state.currentView,
      searchQuery: state.searchQuery,
      setMessagesDrawerOpen: state.setMessagesDrawerOpen,
      setChatListOpen: state.setChatListOpen,
      setCurrentView: state.setCurrentView,
      setSearchQuery: state.setSearchQuery,
      toggleMessagesDrawer: state.toggleMessagesDrawer,
    }))
  );
