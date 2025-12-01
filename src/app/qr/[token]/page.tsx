import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { resolveQrRedirect } from "./_actions";

interface QRRedirectPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function QRRedirectPage({ params }: QRRedirectPageProps) {
  const { token } = await params;
  const defaultLocale = routing.defaultLocale;

  const productPath = routing.pathnames["/dashboard/warehouse/products/[id]"];
  const productTemplate =
    typeof productPath === "string"
      ? productPath
      : productPath[defaultLocale as keyof typeof productPath];

  const locationPath = routing.pathnames["/dashboard/warehouse/locations/[id]"];
  const locationTemplate =
    typeof locationPath === "string"
      ? locationPath
      : locationPath[defaultLocale as keyof typeof locationPath];

  const assignPathConfig = routing.pathnames["/dashboard/warehouse/labels/assign"];
  const assignPath =
    typeof assignPathConfig === "string"
      ? assignPathConfig
      : assignPathConfig[defaultLocale as keyof typeof assignPathConfig];

  const result = await resolveQrRedirect(token, {
    productTemplate,
    locationTemplate,
    assignPath,
  });

  if (result.error === "QR_NOT_FOUND") {
    redirect("/qr/not-found");
  }

  if (result.error === "GENERAL_ERROR" || !result.redirectPath) {
    redirect("/qr/error");
  }

  redirect(result.redirectPath);
}
