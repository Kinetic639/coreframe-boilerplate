import { redirect } from "next/navigation";
import { resolvePublicQrToken } from "@/server/qr/public-token-resolver";

interface QRRedirectPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function QRRedirectPage({ params }: QRRedirectPageProps) {
  const { token } = await params;
  const result = await resolvePublicQrToken(token);

  if (result.ok) {
    redirect(result.redirectPath);
  }

  redirect(`/pl/qr/${token}`);
}
