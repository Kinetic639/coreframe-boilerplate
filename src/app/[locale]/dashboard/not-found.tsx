import { FileQuestion, Home, ArrowLeft } from "lucide-react";
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

export default function DashboardV2NotFound() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            Error 404 - This page could not be found in the dashboard.
          </p>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/start">
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Link>
          </Button>
          <Button onClick={() => window.history.back()} variant="default" className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
