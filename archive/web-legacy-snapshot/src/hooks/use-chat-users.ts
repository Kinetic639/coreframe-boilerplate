"use client";

import { useAppStore } from "@/lib/stores/app-store";
import { useMemo } from "react";

export interface ChatUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function useChatUsers() {
  const { organizationUsers, privateContacts, isLoadingUsers, loadOrganizationUsers } =
    useAppStore();

  // Convert organization users to chat users format
  const orgUsers: ChatUser[] = useMemo(() => {
    return organizationUsers.map((user) => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      avatar_url: user.avatar_url,
    }));
  }, [organizationUsers]);

  // Convert private contacts to chat users format
  const contactUsers: ChatUser[] = useMemo(() => {
    return privateContacts.map((contact) => ({
      id: contact.id,
      first_name: contact.name.split(" ")[0] || contact.name,
      last_name: contact.name.split(" ").slice(1).join(" ") || null,
      email: contact.email || "",
      avatar_url: contact.avatar_url || null,
    }));
  }, [privateContacts]);

  // Combine all users
  const allUsers: ChatUser[] = useMemo(() => {
    return [...orgUsers, ...contactUsers];
  }, [orgUsers, contactUsers]);

  // Filter out users without email (for chat functionality)
  const validChatUsers: ChatUser[] = useMemo(() => {
    return allUsers.filter((user) => user.email && user.email.trim() !== "");
  }, [allUsers]);

  return {
    organizationUsers: orgUsers,
    privateContacts: contactUsers,
    allUsers,
    validChatUsers,
    isLoading: isLoadingUsers,
    loadUsers: loadOrganizationUsers,
    isEmpty: validChatUsers.length === 0,
  };
}
