import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, List, Shield, UserPlus } from "lucide-react";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted/50" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

function UsersOverview() {
  const modules = [
    {
      title: "Lista użytkowników",
      description: "Przeglądaj i zarządzaj wszystkimi użytkownikami organizacji",
      icon: List,
      href: "/dashboard-old/organization/users/list",
      color: "text-blue-500",
      stats: "5 aktywnych użytkowników",
    },
    {
      title: "Role i uprawnienia",
      description: "Zarządzanie rolami i uprawnieniami w organizacji",
      icon: Shield,
      href: "/dashboard-old/organization/users/roles",
      color: "text-green-500",
      stats: "5 zdefiniowanych ról",
    },
    {
      title: "Zaproszenia",
      description: "Zarządzanie zaproszeniami użytkowników do organizacji",
      icon: UserPlus,
      href: "/dashboard-old/organization/users/invitations",
      color: "text-purple-500",
      stats: "Oczekujące zaproszenia",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Zarządzanie użytkownikami</h1>
        <p className="text-muted-foreground">
          Zarządzanie użytkownikami, rolami i uprawnieniami w organizacji
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.title} href={module.href}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{module.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${module.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-xs text-muted-foreground">{module.description}</p>
                  <p className="text-xs font-medium text-primary">{module.stats}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywni użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">W całej organizacji</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">Zdefiniowane role</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nowi użytkownicy</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">W tym miesiącu</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <UsersOverview />
    </Suspense>
  );
}
