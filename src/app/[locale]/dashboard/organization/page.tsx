import { redirect } from "next/navigation";

export default function OrganizationPage() {
  // Redirect to the organization profile page as the default
  redirect("/dashboard/organization/profile");
}
