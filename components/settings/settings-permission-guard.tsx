"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import type { UserPermission } from "@/lib/db/schema";
import { Spinner } from "@/components/ui/spinner";

type SettingsPermissionGuardProps = {
  permissions: UserPermission[];
  children: React.ReactNode;
};

export function SettingsPermissionGuard({ permissions, children }: SettingsPermissionGuardProps) {
  const { user, loading, canAny } = useAuth();
  const router = useRouter();
  const allowed = !!user && canAny(permissions);

  useEffect(() => {
    if (loading) return;
    if (!allowed) {
      router.replace("/transcribe");
    }
  }, [loading, allowed, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
