import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/auth/password";
import { requireAnyPermission, requirePermission, authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import {
  createUser,
  deleteUser,
  getUserByEmail,
  listUsers,
  toUserDto,
} from "@/lib/db/queries-users";
import { buildWelcomeUserEmail } from "@/lib/email/templates/welcome-user";
import { sendEmail } from "@/lib/email/send";
import { userCreateSchema } from "@/lib/validators/user";
import { error, handleRoute, json } from "@/lib/api";

export async function GET(req: Request) {
  return handleRoute(async () => {
    try {
      const sessionUser = await requireAuth(req);
      requireAnyPermission(sessionUser, ["user:create", "user:permission"]);
      const rows = await listUsers();
      return json({ users: rows.map((u) => toUserDto(u)!) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function POST(req: Request) {
  return handleRoute(async () => {
    try {
      const sessionUser = await requireAuth(req);
      requirePermission(sessionUser, "user:create");

      const body = await req.json().catch(() => null);
      const parsed = userCreateSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.issues.map((i) => i.message).join("; "));
      }

      const existing = await getUserByEmail(parsed.data.email);
      if (existing) return error("Email already in use", 409);

      const passwordHash = await hashPassword(parsed.data.password);
      const userId = randomUUID();
      const user = await createUser({
        id: userId,
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        permissions: parsed.data.permissions,
        mustChangePassword: true,
      });

      const emailContent = buildWelcomeUserEmail({
        name: user.name,
        email: user.email,
        password: parsed.data.password,
      });

      try {
        await sendEmail({
          to: user.email,
          ...emailContent,
        });
      } catch (emailErr) {
        await deleteUser(userId);
        const message = emailErr instanceof Error ? emailErr.message : "Failed to send email";
        return error(`User not created: ${message}`, 502);
      }

      return json({ user: toUserDto(user) }, 201);
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
