"use client";

import { ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserAvatar, UserAvatarGroup } from "@/components/primitives/avatar";
import type { UserAvatarGroupItem } from "@/components/primitives/avatar";

const USERS: UserAvatarGroupItem[] = [
  {
    id: "u-1",
    fullName: "Michał Kowalski",
    fallback: "MK",
    email: "michal.kowalski@ambra.app",
    profileHref: "/dashboard/organization/users/members/u-1",
  },
  {
    id: "u-2",
    fullName: "Anna Nowak",
    fallback: "AN",
    email: "anna.nowak@ambra.app",
    profileHref: "/dashboard/organization/users/members/u-2",
  },
  {
    id: "u-3",
    firstName: "Piotr",
    lastName: "Zieliński",
    fallback: "PZ",
    email: "piotr.zielinski@ambra.app",
    profileHref: "/dashboard/organization/users/members/u-3",
  },
  {
    id: "u-4",
    fullName: "Karolina Wiśniewska",
    fallback: "KW",
    email: "karolina.wisniewska@ambra.app",
    profileHref: "/dashboard/organization/users/members/u-4",
  },
  {
    id: "u-5",
    fullName: "Tomasz Wójcik",
    fallback: "TW",
    email: "tomasz.wojcik@ambra.app",
    profileHref: "/dashboard/organization/users/members/u-5",
  },
  {
    id: "u-6",
    fullName: "Ewa Kamińska",
    fallback: "EK",
    email: "ewa.kaminska@ambra.app",
    profileHref: "/dashboard/organization/users/members/u-6",
  },
];

export default function AvatarDemoPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <Badge variant="outline">Primitive demo</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Avatar Primitives</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              User avatar and avatar group wrappers for reusable profile previews.
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-6">
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Single avatar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The primitive stays quiet when no user details are passed, then gains a profile
              preview when name, email, or profile URL is provided.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Default
              </p>
              <UserAvatar fallback="AM" />
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                With details
              </p>
              <UserAvatar
                fullName="Michał Kowalski"
                fallback="MK"
                email="michal.kowalski@ambra.app"
                profileHref="/dashboard/organization/users/members/u-1"
              />
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Larger
              </p>
              <UserAvatar
                fullName="Anna Nowak"
                fallback="AN"
                email="anna.nowak@ambra.app"
                profileHref="/dashboard/organization/users/members/u-2"
                className="h-12 w-12"
              />
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Avatar group</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Visible users keep their profile preview, and the overflow avatar opens a compact
                user list.
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <ExternalLink className="h-3 w-3" />
              Opens profile in new tab
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Small
              </p>
              <UserAvatarGroup users={USERS} max={4} size="sm" />
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Default
              </p>
              <UserAvatarGroup users={USERS} max={4} size="default" />
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Large
              </p>
              <UserAvatarGroup users={USERS} max={3} size="lg" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
