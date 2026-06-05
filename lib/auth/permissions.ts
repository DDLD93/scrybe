import type { UserPermission } from "@/lib/db/schema";

export const USER_PERMISSIONS = [
  "user:create",
  "user:permission",
  "settings:general",
  "settings:systemprompt",
  "file:all",
] as const satisfies readonly UserPermission[];

export const ALL_PERMISSIONS: UserPermission[] = [...USER_PERMISSIONS];

export const PERMISSION_GROUPS = [
  {
    label: "Users",
    permissions: [
      { id: "user:create" as const, label: "Create users", description: "Create new users and view user list" },
      { id: "user:permission" as const, label: "Manage users", description: "Suspend, reset passwords, edit permissions" },
    ],
  },
  {
    label: "Settings",
    permissions: [
      { id: "settings:general" as const, label: "General settings", description: "Manage processing defaults and library view" },
      { id: "settings:systemprompt" as const, label: "System prompts", description: "Manage audio and PDF system prompts" },
    ],
  },
  {
    label: "Files",
    permissions: [
      { id: "file:all" as const, label: "All files", description: "View and manage all users' transcription files" },
    ],
  },
] as const;

export function hasPermission(
  permissions: UserPermission[] | undefined | null,
  permission: UserPermission,
): boolean {
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  permissions: UserPermission[] | undefined | null,
  required: UserPermission[],
): boolean {
  if (!permissions?.length || !required.length) return false;
  return required.some((p) => permissions.includes(p));
}

export function canAccessSettings(permissions: UserPermission[] | undefined | null): boolean {
  return hasAnyPermission(permissions, [
    "settings:general",
    "settings:systemprompt",
    "user:create",
    "user:permission",
  ]);
}

export function canSeeAllFiles(permissions: UserPermission[] | undefined | null): boolean {
  return hasPermission(permissions, "file:all");
}

export function isValidPermission(value: string): value is UserPermission {
  return (USER_PERMISSIONS as readonly string[]).includes(value);
}

export function normalizePermissions(values: string[]): UserPermission[] {
  return values.filter(isValidPermission);
}
