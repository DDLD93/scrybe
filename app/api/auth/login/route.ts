import { getUserByEmail, repairBootstrapAdminPermissions } from "@/lib/db/queries-users";
import { verifyPassword } from "@/lib/auth/password";
import {
  createUserSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { authCredentialsSchema } from "@/lib/validators/user";
import { error, handleRoute, json } from "@/lib/api";
import { toUserDto } from "@/lib/db/queries-users";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = await req.json().catch(() => null);
    const parsed = authCredentialsSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.issues.map((i) => i.message).join("; "));
    }

    let user = await getUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return error("Invalid email or password", 401);
    }
    if (user.status === "suspended") {
      return error("Account suspended", 403);
    }

    user = await repairBootstrapAdminPermissions(user);

    const token = await createUserSession(user.id);
    await setSessionCookie(token);

    return json({ user: toUserDto(user) });
  });
}
