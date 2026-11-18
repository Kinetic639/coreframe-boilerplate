"use client";

import { createContext, useContext, useMemo } from "react";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { useOrgMemberPublicProfilesQuery } from "@/hooks/queries/organization";
import type { OrgMemberPublicProfile } from "@/server/services/org-member-public-profile.service";
import { cn } from "@/utils";

const MAX_PROFILES = 100;

const MemberProfilesContext = createContext<Map<string, OrgMemberPublicProfile> | null>(null);

/**
 * Loads the photos (and profile links) of the people a screen shows in one
 * request, for every MemberAvatar inside. Without it an avatar shows initials.
 */
export function MemberProfilesProvider({
  userIds,
  children,
}: {
  userIds: Array<string | null | undefined>;
  children: React.ReactNode;
}) {
  const parent = useContext(MemberProfilesContext);
  const ids = useMemo(
    () =>
      Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
        .sort()
        .slice(0, MAX_PROFILES),
    [userIds]
  );
  const profiles = useOrgMemberPublicProfilesQuery(ids);
  const value = useMemo(() => {
    const map = new Map(parent ?? []);
    (profiles.data ?? []).forEach((profile) => map.set(profile.user_id, profile));
    return map;
  }, [parent, profiles.data]);
  return <MemberProfilesContext.Provider value={value}>{children}</MemberProfilesContext.Provider>;
}

/**
 * A person's avatar: their photo, initials while it loads, and on hover the
 * name, e-mail and a link to the profile (as on comments).
 */
export function MemberAvatar({
  userId,
  name,
  email,
  className,
  fallbackClassName,
  popoverSide = "top",
  disabledPopover,
}: {
  userId: string | null | undefined;
  name?: string | null;
  email?: string | null;
  className?: string;
  fallbackClassName?: string;
  popoverSide?: "top" | "bottom" | "left" | "right";
  disabledPopover?: boolean;
}) {
  const profiles = useContext(MemberProfilesContext);
  const profile = userId ? profiles?.get(userId) : undefined;
  const fullName = profile?.display_name ?? name ?? null;
  const mail = profile?.email ?? email ?? null;
  return (
    <UserAvatar
      src={profile?.avatar_url}
      fullName={fullName}
      email={mail}
      fallback={fullName ?? mail ?? undefined}
      profileHref={profile?.profile_href}
      popoverSide={popoverSide}
      disabledPopover={disabledPopover}
      className={cn("h-6 w-6", className)}
      fallbackClassName={cn(
        "bg-primary/10 text-[10px] font-semibold text-primary",
        fallbackClassName
      )}
    />
  );
}
