import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, type UserPermission, type UserStatus, users } from "@/lib/db/schema";

export async function countUsers(): Promise<number> {
  const db = getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return row?.count ?? 0;
}

export async function listUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(users.createdAt);
}

export async function getUserById(id: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, normalized))
    .limit(1);
  return user ?? null;
}

export async function createUser(data: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  permissions: UserPermission[];
  mustChangePassword?: boolean;
  status?: UserStatus;
}) {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({
      id: data.id,
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      passwordHash: data.passwordHash,
      permissions: data.permissions,
      mustChangePassword: data.mustChangePassword ?? false,
      status: data.status ?? "active",
    })
    .returning();
  return user!;
}

export async function updateUser(
  id: string,
  patch: {
    name?: string;
    permissions?: UserPermission[];
    status?: UserStatus;
    mustChangePassword?: boolean;
    passwordHash?: string;
  },
) {
  const db = getDb();
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.permissions !== undefined) values.permissions = patch.permissions;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.mustChangePassword !== undefined) values.mustChangePassword = patch.mustChangePassword;
  if (patch.passwordHash !== undefined) values.passwordHash = patch.passwordHash;

  const [user] = await db.update(users).set(values).where(eq(users.id, id)).returning();
  return user ?? null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  return rows.length > 0;
}

export async function createSession(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = getDb();
  const { randomUUID } = await import("crypto");
  const [session] = await db
    .insert(sessions)
    .values({
      id: randomUUID(),
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    })
    .returning();
  return session!;
}

export async function getSessionByTokenHash(tokenHash: string) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  return session ?? null;
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function toUserDto(user: Awaited<ReturnType<typeof getUserById>>) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    permissions: user.permissions ?? [],
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
