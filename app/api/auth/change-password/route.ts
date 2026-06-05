import { getUserById, toUserDto, updateUser } from "@/lib/db/queries-users";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { authErrorResponse, requireAuth } from "@/lib/auth/require-auth";
import { changePasswordSchema } from "@/lib/validators/user";
import { error, handleRoute, json } from "@/lib/api";

export async function POST(req: Request) {
  return handleRoute(async () => {
    try {
      const sessionUser = await requireAuth(req);
      const body = await req.json().catch(() => null);
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.issues.map((i) => i.message).join("; "));
      }

      const user = await getUserById(sessionUser.id);
      if (!user) return error("Unauthorized", 401);

      const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
      if (!valid) return error("Current password is incorrect", 400);

      const passwordHash = await hashPassword(parsed.data.newPassword);
      const updated = await updateUser(user.id, {
        passwordHash,
        mustChangePassword: false,
      });

      return json({ user: toUserDto(updated) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
