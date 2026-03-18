import { AlertCircle, Home, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QRNotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>QR Code Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            The QR code you scanned is not valid or has been deactivated.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">What you can do:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Check if the QR code is damaged</li>
              <li>• Verify you're scanning the correct code</li>
              <li>• Contact your administrator</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-4 sm:flex-row">
            <Button asChild variant="default" className="flex-1">
              <Link href="/dashboard-old">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard-old/warehouse/scanning">
                <Search className="mr-2 h-4 w-4" />
                Try Scanning Again
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
