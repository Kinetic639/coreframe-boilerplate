"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Users,
  Key,
  Crown,
  UserCheck,
  Briefcase,
  Package,
  Calculator,
} from "lucide-react";
import { mockRoles, mockUserRoles, mockUsers } from "@/lib/mock/organization";
import { Tables } from "../../../../../../../supabase/types/types";

export default function RolesPage() {
  const rolesWithUserCount = React.useMemo(() => {
    return mockRoles.map((role) => {
      const userCount = mockUserRoles.filter((ur) => ur.role_id === role.id).length;
      const users = mockUserRoles
        .filter((ur) => ur.role_id === role.id)
        .map((ur) => mockUsers.find((u) => u.id === ur.user_id))
        .filter(Boolean);

      return {
        ...role,
        userCount,
        users,
      };
    });
  }, []);

  const getRoleIcon = (roleSlug: string) => {
    const icons = {
      "org-owner": Crown,
      "branch-manager": Briefcase,
      "warehouse-manager": Package,
      employee: UserCheck,
      accountant: Calculator,
    };
    return icons[roleSlug as keyof typeof icons] || Shield;
  };

  const getRoleColor = (roleSlug: string) => {
    const colors = {
      "org-owner": "text-purple-600",
      "branch-manager": "text-blue-600",
      "warehouse-manager": "text-green-600",
      employee: "text-gray-600",
      accountant: "text-orange-600",
    };
    return colors[roleSlug as keyof typeof colors] || "text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role i uprawnienia</h1>
          <p className="text-muted-foreground">
            Zarządzanie rolami użytkowników i ich uprawnieniami w organizacji
          </p>
        </div>
        <Button variant="themed">
          <Plus className="mr-2 h-4 w-4" />
          Dodaj rolę
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-4"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączna liczba ról</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockRoles.length}</div>
            <p className="text-xs text-muted-foreground">Zdefiniowane role</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Przypisani użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockUserRoles.length}</div>
            <p className="text-xs text-muted-foreground">Aktywne przypisania</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administratorzy</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockUserRoles.filter((ur) => ur.role_id === "org-owner").length}
            </div>
            <p className="text-xs text-muted-foreground">Właściciele organizacji</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uprawnienia</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Różnych uprawnień</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Roles Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Lista ról ({rolesWithUserCount.length})
            </CardTitle>
            <CardDescription>
              Wszystkie role zdefiniowane w organizacji z liczbą przypisanych użytkowników
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rola</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Użytkownicy</TableHead>
                  <TableHead>Uprawnienia</TableHead>
                  <TableHead>Zakres</TableHead>
                  <TableHead className="w-[100px]">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesWithUserCount.map((role) => {
                  const Icon = getRoleIcon(role.slug);
                  const colorClass = getRoleColor(role.slug);

                  return (
                    <TableRow key={role.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md bg-muted ${colorClass}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{role.label}</div>
                            <div className="font-mono text-sm text-muted-foreground">
                              {role.slug}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm">{role.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{role.userCount}</span>
                          {role.userCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Aktywne
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {role.slug === "org-owner"
                              ? "Wszystkie"
                              : role.slug === "branch-manager"
                                ? "Oddział"
                                : role.slug === "warehouse-manager"
                                  ? "Magazyn"
                                  : role.slug === "accountant"
                                    ? "Finanse"
                                    : "Podstawowe"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            role.slug === "org-owner"
                              ? "default"
                              : role.slug.includes("manager")
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {role.slug === "org-owner"
                            ? "Organizacja"
                            : role.slug.includes("manager")
                              ? "Oddział"
                              : "Lokalny"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edytuj rolę
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Key className="mr-2 h-4 w-4" />
                              Zarządzaj uprawnieniami
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Users className="mr-2 h-4 w-4" />
                              Zobacz użytkowników
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              disabled={role.userCount > 0}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Usuń rolę
                              {role.userCount > 0 && (
                                <span className="ml-auto text-xs">(ma użytkowników)</span>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Role Details Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {rolesWithUserCount.map((role) => {
          const Icon = getRoleIcon(role.slug);
          const colorClass = getRoleColor(role.slug);

          return (
            <Card key={role.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${colorClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{role.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">{role.userCount} użytkowników</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{role.description}</p>

                {role.users && role.users.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      Przypisani użytkownicy:
                    </div>
                    <div className="space-y-1">
                      {role.users.slice(0, 3).map((user: Tables<"users">) => (
                        <div key={user.id} className="text-xs">
                          {user.first_name} {user.last_name}
                        </div>
                      ))}
                      {role.users.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{role.users.length - 3} więcej
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </motion.div>
    </div>
  );
}
