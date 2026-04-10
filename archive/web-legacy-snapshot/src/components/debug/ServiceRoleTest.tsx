"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { testServiceRoleConnection } from "@/app/actions/_debug/test-service-role";

export function ServiceRoleTest() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const testResult = await testServiceRoleConnection();
      setResult(testResult);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">🔧 Service Role Client Test</CardTitle>
        <CardDescription>
          Test if the service role client can connect to Supabase properly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runTest} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run Service Role Test
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">{result.success ? "✅ Success" : "❌ Error"}</div>
                <div>{result.success ? result.message : result.error}</div>
                {result.code && <div className="text-sm opacity-75">Error Code: {result.code}</div>}
                {result.sampleData && (
                  <pre className="rounded bg-muted p-2 text-sm">
                    {JSON.stringify(result.sampleData, null, 2)}
                  </pre>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
