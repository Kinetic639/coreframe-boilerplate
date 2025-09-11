import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { generateDashboardMetadata, MetadataProps } from "@/lib/metadata";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; userId: string }>;
};

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  return generateDashboardMetadata(params, "metadata.dashboard.teams.contacts.profile");
}

interface UserDetail {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  default_branch_id: string | null;
  deleted_at: string | null;
  roles: Array<{
    name: string;
    color: string | null;
    scope: string;
  }>;
  branch: {
    name: string;
    id: string;
  } | null;
  permission_overrides: any;
}

async function getUserDetail(orgId: string, userId: string): Promise<UserDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_user_detail", {
    org_id: orgId,
    target_user_id: userId,
  });

  if (error) {
    console.error("Error fetching user detail:", error);
    return null;
  }

  return data?.[0] || null;
}

export default async function UserProfilePage({ params }: Props) {
  const { userId } = await params;
  const appContext = await loadAppContextServer();
  const t = await getTranslations("modules.teams.items.contacts.pages.profile");

  if (!appContext?.activeOrgId) {
    return notFound();
  }

  const userDetail = await getUserDetail(appContext.activeOrgId, userId);

  if (!userDetail) {
    return notFound();
  }

  const fullName =
    [userDetail.first_name, userDetail.last_name].filter(Boolean).join(" ") || "Unknown User";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joinedDate = new Date(userDetail.created_at).toLocaleDateString();

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/teams/contacts">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Contacts
          </Link>
        </Button>
      </div>

      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-6 sm:flex-row">
            <Avatar className="mx-auto h-24 w-24 sm:mx-0">
              <AvatarImage src={""} alt={fullName} />
              <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div>
                <CardTitle className="text-2xl">{fullName}</CardTitle>
                <CardDescription className="mt-1 text-base">{userDetail.email}</CardDescription>
              </div>

              {/* Roles */}
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {userDetail.roles.map((role, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    style={{
                      borderColor: role.color || undefined,
                      color: role.color || undefined,
                    }}
                  >
                    {role.name} ({role.scope})
                  </Badge>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-4 sm:flex-row">
                <Button className="flex-1 sm:flex-none">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("sendMessage")}
                </Button>
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("addToContacts")}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Contact Information */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("contact")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("email")}</p>
                  <p className="text-sm text-muted-foreground">{userDetail.email}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("phone")}</p>
                  <p className="text-sm text-muted-foreground">Not provided</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {userDetail.branch && (
                <>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{t("branch")}</p>
                      <p className="text-sm text-muted-foreground">{userDetail.branch.name}</p>
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("joinedDate")}</p>
                  <p className="text-sm text-muted-foreground">{joinedDate}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Roles & Permissions</CardTitle>
          <CardDescription>User roles and access levels within the organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userDetail.roles.map((role, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: role.color || "#666" }}
                  />
                  <div>
                    <p className="font-medium">{role.name}</p>
                    <p className="text-sm text-muted-foreground">Scope: {role.scope}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
