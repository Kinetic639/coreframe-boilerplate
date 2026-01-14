import { Metadata } from "next";
import { generateDashboardMetadata, MetadataProps } from "@/lib/metadata";
import { CustomContactsClient } from "@/components/teams/contacts/CustomContactsClient";

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  return generateDashboardMetadata(params, "metadata.dashboard.teams.contacts.custom");
}

export default function CustomContactsPage() {
  return <CustomContactsClient />;
}
