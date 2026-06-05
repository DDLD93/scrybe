import { z } from "zod";
import { USER_PERMISSIONS } from "@/lib/auth/permissions";

export const authCredentialsSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const setupSchema = authCredentialsSchema.extend({
  name: z.string().min(1, "Name is required").max(120),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const userCreateSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters"),
  permissions: z.array(z.enum(USER_PERMISSIONS)).default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  permissions: z.array(z.enum(USER_PERMISSIONS)).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});
