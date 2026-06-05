"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { SystemSettingsForm } from "@/components/settings/system-settings-form";
import { SettingsPermissionGuard } from "@/components/settings/settings-permission-guard";
import { Spinner } from "@/components/ui/spinner";

export default function SystemSettingsPage() {
  const router = useRouter();
  const { user, loading, can, canAny } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (can("settings:general")) return;
    if (can("settings:systemprompt")) {
      router.replace("/transcribe/settings/prompts");
      return;
    }
    if (canAny(["user:create", "user:permission"])) {
      router.replace("/transcribe/settings/users");
      return;
    }
    router.replace("/transcribe");
  }, [loading, user, can, canAny, router]);

  if (loading || !can("settings:general")) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <SettingsPermissionGuard permissions={["settings:general"]}>
      <SystemSettingsForm />
    </SettingsPermissionGuard>
  );
}
