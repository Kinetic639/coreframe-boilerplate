import { listAttachmentsForTargetAction } from "@/app/actions/attachments";
import { listCommentsForTargetAction } from "@/app/actions/comments";
import { listMentionPeopleAction, resolveMentionsAction } from "@/app/actions/mentions";
import {
  getConversationAction,
  listChatInvitationsAction,
  listChatPeopleAction,
  listConversationsAction,
  listMessagesAction,
  listPendingChatInvitesAction,
} from "@/app/actions/messages";
import {
  getUnreadNotificationsCountAction,
  listNotificationsAction,
} from "@/app/actions/notifications";
import { listOrgMemberPublicProfilesAction } from "@/app/actions/organization/member-public-profiles";
import { listQrCodesAction } from "@/app/actions/qr/list";
import {
  getDashboardSettingsAction,
  getUserPreferencesAction,
} from "@/app/actions/user-preferences";

/**
 * Shared reads served over GET (/api/read/<name>), like the planning reads.
 *
 * Next.js runs Server Actions one at a time per page, and a page change waits
 * while one is running. Reads that every screen makes (files, comments,
 * people, notifications, chat) used to queue there behind each other and
 * behind saves; after many quick clicks the queue grew until links, panels and
 * images seemed frozen. As GETs they run at once, side by side.
 *
 * Each entry is the existing action, so sign-in, permission and input checks
 * stay where they are. Only reads belong here.
 */
export const appReads = {
  attachments: listAttachmentsForTargetAction,
  comments: listCommentsForTargetAction,
  mentionPeople: listMentionPeopleAction,
  resolveMentions: resolveMentionsAction,
  memberProfiles: listOrgMemberPublicProfilesAction,
  notifications: listNotificationsAction,
  unreadNotifications: getUnreadNotificationsCountAction,
  qrCodes: listQrCodesAction,
  conversations: listConversationsAction,
  conversation: getConversationAction,
  messages: listMessagesAction,
  chatInvitations: listChatInvitationsAction,
  pendingChatInvites: listPendingChatInvitesAction,
  chatPeople: listChatPeopleAction,
  userPreferences: getUserPreferencesAction,
  dashboardSettings: getDashboardSettingsAction,
} as const;

export type AppReads = typeof appReads;
export type AppReadName = keyof AppReads;
