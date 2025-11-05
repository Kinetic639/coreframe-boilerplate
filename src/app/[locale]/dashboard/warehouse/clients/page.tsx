// =============================================
// Clients List Page (Customers)
// =============================================

import { ClientsListView } from "@/modules/contacts/components/clients-list-view";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contacts");

  return {
    title: t("clients.pageTitle"),
    description: t("clients.pageDescription"),
  };
}

export default async function ClientsPage() {
  return (
    <div className="container mx-auto py-6">
      <ClientsListView />
    </div>
  );
}
