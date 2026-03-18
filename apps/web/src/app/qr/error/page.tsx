"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QRErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-50">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <CardTitle>QR Code Processing Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            There was an error processing your QR code. This might be a temporary issue.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">What you can do:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Try scanning the code again</li>
              <li>• Check your internet connection</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-4 sm:flex-row">
            <Button asChild variant="default" className="flex-1">
              <Link href="/dashboard-old">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
