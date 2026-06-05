import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import {
  createSession,
  deleteSessionByTokenHash,
  getSessionByTokenHash,
  getUserById,
} from "@/lib/db/queries-users";
import type { UserPermission, UserStatus } from "@/lib/db/schema";

export const SESSION_COOKIE = "scrybe_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  permissions: UserPermission[];
  status: UserStatus;
  mustChangePassword: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}:${config.sessionSecret}`).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function toSessionUser(user: {
  id: string;
  email: string;
  name: string;
  permissions: UserPermission[] | null;
  status: UserStatus;
  mustChangePassword: boolean;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    permissions: user.permissions ?? [],
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function createUserSession(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createSession({ userId, tokenHash, expiresAt });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSessionTokenFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function resolveSessionUser(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await getSessionByTokenHash(tokenHash);
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }
  const user = await getUserById(session.userId);
  if (!user || user.status === "suspended") {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }
  return toSessionUser(user);
}

export async function destroySession(token: string | null): Promise<void> {
  if (!token) return;
  await deleteSessionByTokenHash(hashToken(token));
}
