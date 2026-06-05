import { buildWelcomeUserEmail } from "@/lib/email/templates/welcome-user";
import { sendEmail } from "@/lib/email/send";
import { generatePassword, hashPassword } from "@/lib/auth/password";
import { authErrorResponse, requireAuth, requirePermission } from "@/lib/auth/require-auth";
import {
  deleteSessionsForUser,
  getUserById,
  toUserDto,
  updateUser,
} from "@/lib/db/queries-users";
import { error, handleRoute, json } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const sessionUser = await requireAuth(req);
      requirePermission(sessionUser, "user:permission");
      const { id } = await params;

      if (id === sessionUser.id) {
        return error("Cannot reset your own password via admin action", 400);
      }

      const user = await getUserById(id);
      if (!user) return error("Not found", 404);

      const tempPassword = generatePassword();
      const passwordHash = await hashPassword(tempPassword);
      const updated = await updateUser(id, {
        passwordHash,
        mustChangePassword: true,
      });
      await deleteSessionsForUser(id);

      const emailContent = buildWelcomeUserEmail({
        name: user.name,
        email: user.email,
        password: tempPassword,
        isReset: true,
      });

      try {
        await sendEmail({
          to: user.email,
          ...emailContent,
        });
      } catch (emailErr) {
        const message = emailErr instanceof Error ? emailErr.message : "Failed to send email";
        return error(message, 502);
      }

      return json({ user: toUserDto(updated), reset: true });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
