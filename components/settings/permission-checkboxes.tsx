"use client";

import { PERMISSION_GROUPS } from "@/lib/auth/permissions";
import type { UserPermission } from "@/lib/db/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type PermissionCheckboxesProps = {
  value: UserPermission[];
  onChange: (permissions: UserPermission[]) => void;
  disabled?: boolean;
};

export function PermissionCheckboxes({ value, onChange, disabled }: PermissionCheckboxesProps) {
  function toggle(permission: UserPermission, checked: boolean) {
    if (checked) {
      onChange([...value, permission]);
    } else {
      onChange(value.filter((p) => p !== permission));
    }
  }

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="space-y-2">
            {group.permissions.map((perm) => {
              const checked = value.includes(perm.id);
              return (
                <div key={perm.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`perm-${perm.id}`}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(state) => toggle(perm.id, state === true)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label htmlFor={`perm-${perm.id}`} className="cursor-pointer font-normal">
                      {perm.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
