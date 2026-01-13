import React from "react";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnouncementHistoryList } from "@/components/announcements/AnnouncementHistoryList";
import { AddAnnouncementDialog } from "@/components/announcements/AddAnnouncementDialog";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

export default async function AnnouncementsPage() {
  const t = await getTranslations("announcements");
  const appContext = await loadAppContextServer();

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("announcementsHistory")}</h1>
            <p className="text-muted-foreground">
              View and manage all announcements in your organization
            </p>
          </div>

          {appContext?.activeOrgId && (
            <HasAnyRoleServer
              checks={[{ role: "org_owner", scope: "org", id: appContext.activeOrgId }]}
            >
              <AddAnnouncementDialog>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addAnnouncement")}
                </Button>
              </AddAnnouncementDialog>
            </HasAnyRoleServer>
          )}
        </div>

        <AnnouncementHistoryList />
      </div>
    </div>
  );
}
