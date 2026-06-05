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

  useEffect(() => {
    if (loading) return;
    if (!user || !canAny(permissions)) {
      router.replace("/transcribe");
    }
  }, [loading, user, canAny, permissions, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!user || !canAny(permissions)) return null;

  return <>{children}</>;
}
