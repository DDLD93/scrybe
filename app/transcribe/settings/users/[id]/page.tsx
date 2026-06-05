"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import { PermissionCheckboxes } from "@/components/settings/permission-checkboxes";
import { SettingsPermissionGuard } from "@/components/settings/settings-permission-guard";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { UserPermission, UserStatus } from "@/lib/db/schema";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  permissions: UserPermission[];
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
};

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [permOpen, setPermOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editPermissions, setEditPermissions] = useState<UserPermission[]>([]);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load user");
      setUser(data.user);
      setEditPermissions(data.user.permissions ?? []);
      setEditName(data.user.name ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSuspendToggle() {
    if (!user || !can("user:permission")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: user.status === "active" ? "suspended" : "active",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update user");
      toast.success(user.status === "active" ? "User suspended" : "User reactivated");
      setUser(data.user);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePermissions() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, permissions: editPermissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update user");
      toast.success("User updated");
      setUser(data.user);
      setPermOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset password");
      toast.success("New password sent by email");
      setUser(data.user);
      setResetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPermissionGuard permissions={["user:create", "user:permission"]}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/transcribe/settings/users">
              <IconArrowLeft className="size-4" />
            </Link>
          </Button>
          <h2 className="text-lg font-medium">User details</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">User not found.</p>
        ) : (
          <div className="space-y-6 rounded-lg border border-border/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={user.status === "active" ? "default" : "destructive"}>
                  {user.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Must change password</p>
                <p className="text-sm">{user.mustChangePassword ? "Yes" : "No"}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">Permissions</p>
              <div className="flex flex-wrap gap-1">
                {user.permissions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None</span>
                ) : (
                  user.permissions.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {can("user:permission") && (
              <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
                <Button variant="outline" size="sm" onClick={() => setPermOpen(true)} disabled={saving}>
                  Edit permissions
                </Button>
                <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={saving}>
                  Reset password
                </Button>
                <Button
                  variant={user.status === "active" ? "destructive" : "default"}
                  size="sm"
                  onClick={handleSuspendToggle}
                  disabled={saving}
                >
                  {user.status === "active" ? "Suspend" : "Unsuspend"}
                </Button>
              </div>
            )}
          </div>
        )}

        <Dialog open={permOpen} onOpenChange={setPermOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <PermissionCheckboxes
                value={editPermissions}
                onChange={setEditPermissions}
                disabled={saving}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} disabled={saving}>
                {saving ? <Spinner className="size-4" /> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              A new temporary password will be generated and sent to {user?.email}. The user will
              be signed out and required to change it on next login.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={saving}>
                {saving ? <Spinner className="size-4" /> : "Reset and email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsPermissionGuard>
  );
}
