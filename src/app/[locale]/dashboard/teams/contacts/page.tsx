import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateDashboardMetadata, MetadataProps } from "@/lib/metadata";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { Building2, Mail, Search, Users2 } from "lucide-react";
import Link from "next/link";
import { SendMessageButton } from "@/components/contacts/SendMessageButton";

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  return generateDashboardMetadata(params, "metadata.dashboard.teams.contacts");
}

interface OrganizationUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  default_branch_id: string | null;
  role: {
    name: string;
    color: string | null;
  } | null;
  branch: {
    name: string;
    id: string;
  } | null;
}

async function getOrganizationUsers(orgId: string): Promise<OrganizationUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_organization_users", {
    org_id: orgId,
  });

  if (error) {
    console.error("Error fetching organization users:", error);
    return [];
  }

  return data || [];
}

export default async function OrganizationContactsPage() {
  const appContext = await loadAppContextServer();
  const t = await getTranslations("modules.teams.items.contacts.pages.organization");

  if (!appContext?.activeOrgId) {
    return (
      <div className="space-y-6">
        <div className="text-center text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  const users = await getOrganizationUsers(appContext.activeOrgId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Users2 className="h-5 w-5 text-muted-foreground" />
          <Badge variant="outline">{users.length} members</Badge>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("searchPlaceholder")} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Organization Members Grid */}
      {users.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => {
            const fullName =
              [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown User";
            const initials = fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card key={user.id} className="group transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || undefined} alt={fullName} />
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{fullName}</CardTitle>
                      <CardDescription className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        {user.email}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Role Badge */}
                    {user.role && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: user.role.color || undefined,
                          color: user.role.color || undefined,
                        }}
                      >
                        {user.role.name}
                      </Badge>
                    )}

                    {/* Branch Info */}
                    {user.branch && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {user.branch.name}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/dashboard/teams/contacts/profile/${user.id}`}>
                          {t("viewProfile")}
                        </Link>
                      </Button>
                      <SendMessageButton
                        userId={user.id}
                        userName={fullName}
                        variant="outline"
                        size="sm"
                        className="px-3"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>{t("noResults")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
