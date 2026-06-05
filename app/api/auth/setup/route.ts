import { randomUUID } from "crypto";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { createUserSession, setSessionCookie } from "@/lib/auth/session";
import { countUsers, createUser, getUserByEmail, toUserDto } from "@/lib/db/queries-users";
import { setupSchema } from "@/lib/validators/user";
import { error, handleRoute, json } from "@/lib/api";

export async function POST(req: Request) {
  return handleRoute(async () => {
    if ((await countUsers()) > 0) {
      return error("Setup already completed", 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.issues.map((i) => i.message).join("; "));
    }

    const existing = await getUserByEmail(parsed.data.email);
    if (existing) return error("Email already in use");

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({
      id: randomUUID(),
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      permissions: ALL_PERMISSIONS,
      mustChangePassword: false,
    });

    const token = await createUserSession(user.id);
    await setSessionCookie(token);

    return json({ user: toUserDto(user) }, 201);
  });
}
