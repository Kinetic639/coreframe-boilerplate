"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardV2Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    console.error("Dashboard V2 Error:", error);

    // TODO: Send error to logging service (e.g., Sentry)
    // logErrorToService(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We encountered an unexpected error while loading the dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {process.env.NODE_ENV === "development" && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-mono text-muted-foreground break-words">{error.message}</p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">Error ID: {error.digest}</p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            You can try refreshing the page or return to the dashboard home.
          </p>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button onClick={reset} className="flex-1" variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/start">
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
