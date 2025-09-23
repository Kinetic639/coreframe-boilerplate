"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { testLogoAccess } from "@/app/actions/test-logo-access";

interface LogoDebugProps {
  organizationId: string;
  currentLogoUrl?: string | null;
}

export default function LogoDebug({ organizationId, currentLogoUrl }: LogoDebugProps) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const testResult = await testLogoAccess(organizationId);
      setResult(testResult);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Logo Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p>
            <strong>Organization ID:</strong> {organizationId}
          </p>
          <p>
            <strong>Current Logo URL in DB:</strong> {currentLogoUrl || "None"}
          </p>
        </div>

        <Button onClick={handleTest} disabled={loading}>
          {loading ? "Testing..." : "Test Logo Access"}
        </Button>

        {result && (
          <div className="space-y-2">
            <h3 className="font-semibold">Test Results:</h3>
            <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>

            {result.exists && (
              <div className="font-semibold text-green-600">
                ✅ Logo file exists and is accessible!
              </div>
            )}

            {result.exists === false && (
              <div className="font-semibold text-red-600">
                ❌ Logo file does not exist or is not accessible!
              </div>
            )}

            {result.publicUrl && (
              <div className="space-y-2">
                <p>
                  <strong>Generated Public URL:</strong>
                </p>
                <a
                  href={result.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-blue-600 underline"
                >
                  {result.publicUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
