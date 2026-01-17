"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { useLocations } from "@/hooks/use-locations";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LocationsDebugPage() {
  const { activeBranchId, locations: storeLocations, isLoaded } = useAppStore();
  const { locations: hookLocations, isLoading } = useLocations();
  const [directQueryResult, setDirectQueryResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testDirectQuery = async () => {
      if (!activeBranchId) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("locations")
          .select("*")
          .eq("branch_id", activeBranchId)
          .is("deleted_at", null);

        if (error) {
          setError(`Direct query error: ${error.message}`);
        } else {
          setDirectQueryResult(data);
        }
      } catch (err) {
        setError(`Direct query exception: ${err}`);
      }
    };

    testDirectQuery();
  }, [activeBranchId]);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-bold">Locations Debug</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>App Store State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>Is Loaded:</strong>{" "}
              <Badge variant={isLoaded ? "secondary" : "destructive"}>
                {isLoaded ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <strong>Active Branch ID:</strong>{" "}
              <code className="rounded bg-muted p-1 text-xs">{activeBranchId || "None"}</code>
            </div>
            <div>
              <strong>Store Locations Count:</strong>{" "}
              <Badge variant="outline">{storeLocations.length}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Store locations:{" "}
              {JSON.stringify(
                storeLocations.map((l) => ({ id: l.id, name: l.name })),
                null,
                2
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>useLocations Hook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>Is Loading:</strong>{" "}
              <Badge variant={isLoading ? "secondary" : "outline"}>
                {isLoading ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <strong>Hook Locations Count:</strong>{" "}
              <Badge variant="outline">{hookLocations.length}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Hook locations:{" "}
              {JSON.stringify(
                hookLocations.map((l) => ({ id: l.id, name: l.name })),
                null,
                2
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Direct Supabase Query</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {error ? (
              <div className="text-red-500">{error}</div>
            ) : directQueryResult ? (
              <div>
                <div>
                  <strong>Direct Query Count:</strong>{" "}
                  <Badge variant="outline">{directQueryResult.length}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <pre>{JSON.stringify(directQueryResult, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div>Loading direct query...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
