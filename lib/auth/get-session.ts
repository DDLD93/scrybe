import {
  getSessionTokenFromCookies,
  getSessionTokenFromRequest,
  resolveSessionUser,
  type SessionUser,
} from "@/lib/auth/session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionTokenFromCookies();
  return resolveSessionUser(token);
}

export async function getSessionUserFromRequest(req: Request): Promise<SessionUser | null> {
  const token = await getSessionTokenFromRequest(req);
  return resolveSessionUser(token);
}

export type { SessionUser };
