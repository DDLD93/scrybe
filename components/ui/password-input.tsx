"use client";

import { useState } from "react";
import { IconCopy, IconEye, IconEyeOff, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generatePassword } from "@/lib/auth/generate-password-client";
import { cn } from "@/lib/utils";

type PasswordInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  className,
  placeholder = "Enter password",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  function handleGenerate() {
    const pwd = generatePassword();
    onChange(pwd);
    toast.success("Password generated");
  }

  async function handleCopy() {
    if (!value) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1"
        autoComplete="new-password"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleGenerate}
        disabled={disabled}
        title="Generate password"
      >
        <IconRefresh className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleCopy}
        disabled={disabled || !value}
        title="Copy password"
      >
        <IconCopy className="size-4" />
      </Button>
    </div>
  );
}
