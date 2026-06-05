import { error } from "@/lib/api";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import { getSessionUserFromRequest, type SessionUser } from "@/lib/auth/get-session";
import type { UserPermission } from "@/lib/db/schema";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function requireAuth(req: Request): Promise<SessionUser> {
  const user = await getSessionUserFromRequest(req);
  if (!user) throw new AuthError("Unauthorized", 401);
  if (user.status === "suspended") throw new AuthError("Account suspended", 403);
  return user;
}

export function requirePermission(user: SessionUser, permission: UserPermission): void {
  if (!hasPermission(user.permissions, permission)) {
    throw new AuthError("Forbidden", 403);
  }
}

export function requireAnyPermission(user: SessionUser, permissions: UserPermission[]): void {
  if (!hasAnyPermission(user.permissions, permissions)) {
    throw new AuthError("Forbidden", 403);
  }
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) return error(err.message, err.status);
  throw err;
}
