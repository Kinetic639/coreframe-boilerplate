import { Loader2 } from "lucide-react";

export default function QRRedirectLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <h2 className="text-lg font-semibold">Processing QR Code...</h2>
        <p className="text-muted-foreground">
          Please wait while we redirect you to the correct page.
        </p>
      </div>
    </div>
  );
}
