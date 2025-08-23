"use client";

import { useState } from "react";
import { testUserPermissions } from "@/app/actions/test-permissions";
import { debugAppContext } from "@/app/actions/debug-app-context";
import { debugUserContext } from "@/app/actions/debug-user-context";
import { debugJwtToken } from "@/app/actions/debug-jwt-token";
// opcjonalnie kiedy będziesz mieć akcję do testu service role:
// import { debugServiceRole } from "@/app/actions/debug-service-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PermissionTestComponent() {
  const [result, setResult] = useState<any>(null);
  const [appContextResult, setAppContextResult] = useState<any>(null);
  const [userContextResult, setUserContextResult] = useState<any>(null);
  const [jwtResult, setJwtResult] = useState<any>(null);

  // 🔧 brakujący stan – to usuwa ReferenceError
  const serviceRoleResult: any = null;

  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const testResult = await testUserPermissions();
      setResult(testResult);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  const handleAppContextTest = async () => {
    setLoading(true);
    try {
      const appResult = await debugAppContext();
      setAppContextResult(appResult);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setAppContextResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  const handleUserContextTest = async () => {
    setLoading(true);
    try {
      const userResult = await debugUserContext();
      setUserContextResult(userResult);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setUserContextResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  const handleJwtTest = async () => {
    setLoading(true);
    try {
      const res = await debugJwtToken();
      setJwtResult(res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setJwtResult({ error: message, success: false });
    } finally {
      setLoading(false);
    }
  };

  // Jeśli kiedyś dodasz akcję do testu service role, możesz odkomentować:
  // const handleServiceRoleTest = async () => {
  //   setLoading(true);
  //   try {
  //     const res = await debugServiceRole();
  //     setServiceRoleResult(res);
  //   } catch (error: unknown) {
  //     const message = error instanceof Error ? error.message : "Unknown error";
  //     setServiceRoleResult({ success: false, error: message });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Permission System Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleTest} disabled={loading}>
            {loading ? "Testing..." : "Test Backend Permissions"}
          </Button>
          <Button onClick={handleAppContextTest} disabled={loading}>
            {loading ? "Testing..." : "Debug App Context"}
          </Button>
          <Button onClick={handleUserContextTest} disabled={loading}>
            {loading ? "Testing..." : "Debug User Context"}
          </Button>
          <Button onClick={handleJwtTest} disabled={loading} variant="secondary">
            {loading ? "Testing..." : "Debug JWT Token"}
          </Button>

          {/* Gdy będzie akcja service role, możesz dodać przycisk:
          <Button onClick={handleServiceRoleTest} disabled={loading} variant="outline">
            {loading ? "Testing..." : "Test Service Role Client"}
          </Button>
          */}
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
            {appContextResult.wouldRedirect ? (
              <div className="font-semibold text-red-600">
                ❌ App context would cause redirect to login!
              </div>
            ) : (
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
            {userContextResult.permissions?.length > 0 ? (
              <div className="font-semibold text-green-600">
                ✅ User has {userContextResult.permissions.length} permissions loaded!
              </div>
            ) : (
              <div className="font-semibold text-red-600">❌ User has no permissions loaded!</div>
            )}
          </div>
        )}

        {serviceRoleResult && (
          <div className="space-y-2">
            <h3 className="font-semibold">Service Role Connection Test:</h3>
            <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(serviceRoleResult, null, 2)}
            </pre>
            {serviceRoleResult.success ? (
              <div className="font-semibold text-green-600">
                ✅ Service role client connected successfully!
              </div>
            ) : (
              <div className="font-semibold text-red-600">
                ❌ Service role client connection failed!
              </div>
            )}
          </div>
        )}

        {jwtResult && (
          <div className="space-y-2">
            <h3 className="font-semibold">JWT Token Debug:</h3>
            <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
              {JSON.stringify(jwtResult, null, 2)}
            </pre>
            {jwtResult.success && !jwtResult.testQueryError && (
              <div className="font-semibold text-green-600">
                ✅ JWT token working and RLS policies allow access!
              </div>
            )}
            {jwtResult.success && jwtResult.testQueryError && (
              <div className="font-semibold text-red-600">
                ❌ JWT token valid but RLS policies block access: {jwtResult.testQueryError}
              </div>
            )}
            {!jwtResult.success && (
              <div className="font-semibold text-red-600">❌ JWT token debug failed!</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
