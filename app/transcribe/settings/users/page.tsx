"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconPlus, IconUser } from "@tabler/icons-react";
import { toast } from "sonner";
import { SettingsPermissionGuard } from "@/components/settings/settings-permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";
import type { UserPermission, UserStatus } from "@/lib/db/schema";

type UserRow = {
  id: string;
  name: string;
  email: string;
  permissions: UserPermission[];
  status: UserStatus;
};

export default function UsersSettingsPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load users");
      setUsers(data.users ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SettingsPermissionGuard permissions={["user:create", "user:permission"]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Users</h2>
            <p className="text-sm text-muted-foreground">Manage system users and permissions.</p>
          </div>
          {can("user:create") && (
            <Button asChild size="sm">
              <Link href="/transcribe/settings/users/new">
                <IconPlus className="size-4" />
                Create user
              </Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users yet
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.status === "active" ? "default" : "destructive"}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.permissions.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            user.permissions.map((p) => (
                              <Badge key={p} variant="secondary" className="text-[0.6rem]">
                                {p}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/transcribe/settings/users/${user.id}`}>
                            <IconUser className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </SettingsPermissionGuard>
  );
}
