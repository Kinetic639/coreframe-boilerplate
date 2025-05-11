"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export type User = {
  id: string;
  username: string;
};

interface UsersTableProps {
  users: User[];
  onUpdateRole: (userId: string, role: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export function UsersTable({ users, onUpdateRole, onDeleteUser }: UsersTableProps) {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  const handleUpdateRole = async (userId: string, role: string) => {
    setIsLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await onUpdateRole(userId, role);
    } finally {
      setIsLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await onDeleteUser(userId);
    } finally {
      setIsLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.username}</TableCell>
              <TableCell>
                {user.role ? (
                  <Badge variant="outline" className="capitalize">
                    {user.role}
                  </Badge>
                ) : (
                  <Badge variant="outline">user</Badge>
                )}
              </TableCell>
              <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isLoading[user.id]}>
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        handleUpdateRole(user.id, user.role === "admin" ? "specialist" : "admin")
                      }
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      {user.role === "admin" ? "Set as Specialist" : "Set as Admin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteUser(user.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
