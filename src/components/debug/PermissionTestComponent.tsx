"use client";

import { useState } from "react";
import { testUserPermissions } from "@/app/actions/test-permissions";
import { debugAppContext } from "@/app/actions/debug-app-context";
import { debugUserContext } from "@/app/actions/debug-user-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PermissionTestComponent() {
  const [result, setResult] = useState<any>(null);
  const [appContextResult, setAppContextResult] = useState<any>(null);
  const [userContextResult, setUserContextResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const testResult = await testUserPermissions();
      setResult(testResult);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAppContextTest = async () => {
    setLoading(true);
    try {
      const appResult = await debugAppContext();
      setAppContextResult(appResult);
    } catch (error) {
      setAppContextResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUserContextTest = async () => {
    setLoading(true);
    try {
      const userResult = await debugUserContext();
      setUserContextResult(userResult);
    } catch (error) {
      setUserContextResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Permission System Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={loading}>
            {loading ? "Testing..." : "Test Backend Permissions"}
          </Button>
          <Button onClick={handleAppContextTest} disabled={loading}>
            {loading ? "Testing..." : "Debug App Context"}
          </Button>
          <Button onClick={handleUserContextTest} disabled={loading}>
            {loading ? "Testing..." : "Debug User Context"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <h3 className="font-semibold">Test Results:</h3>
            <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>

            {result.isAuthorized && (
              <div className="font-semibold text-green-600">✅ User has required permissions!</div>
            )}

            {result.isAuthorized === false && (
              <div className="font-semibold text-red-600">❌ User lacks required permissions!</div>
            )}
          </div>
        )}

        {appContextResult && (
          <div className="space-y-2">
            <h3 className="font-semibold">App Context Debug:</h3>
            <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(appContextResult, null, 2)}
            </pre>

            {appContextResult.wouldRedirect && (
              <div className="font-semibold text-red-600">
                ❌ App context would cause redirect to login!
              </div>
            )}

            {!appContextResult.wouldRedirect && (
              <div className="font-semibold text-green-600">
                ✅ App context should allow access!
              </div>
            )}
          </div>
        )}

        {userContextResult && (
          <div className="space-y-2">
            <h3 className="font-semibold">User Context Debug:</h3>
            <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(userContextResult, null, 2)}
            </pre>

            {userContextResult.permissions && userContextResult.permissions.length > 0 && (
              <div className="font-semibold text-green-600">
                ✅ User has {userContextResult.permissions.length} permissions loaded!
              </div>
            )}

            {(!userContextResult.permissions || userContextResult.permissions.length === 0) && (
              <div className="font-semibold text-red-600">❌ User has no permissions loaded!</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
