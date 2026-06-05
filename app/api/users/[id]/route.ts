import {
  authErrorResponse,
  requireAnyPermission,
  requireAuth,
  requirePermission,
} from "@/lib/auth/require-auth";
import { deleteSessionsForUser, getUserById, toUserDto, updateUser } from "@/lib/db/queries-users";
import { userUpdateSchema } from "@/lib/validators/user";
import { error, handleRoute, json } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const sessionUser = await requireAuth(req);
      requireAnyPermission(sessionUser, ["user:create", "user:permission"]);
      const { id } = await params;
      const user = await getUserById(id);
      if (!user) return error("Not found", 404);
      return json({ user: toUserDto(user) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}

export async function PATCH(req: Request, { params }: Params) {
  return handleRoute(async () => {
    try {
      const sessionUser = await requireAuth(req);
      requirePermission(sessionUser, "user:permission");
      const { id } = await params;

      if (id === sessionUser.id) {
        return error("Cannot modify your own account via admin actions", 400);
      }

      const user = await getUserById(id);
      if (!user) return error("Not found", 404);

      const body = await req.json().catch(() => null);
      const parsed = userUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.issues.map((i) => i.message).join("; "));
      }

      const updated = await updateUser(id, parsed.data);
      if (parsed.data.status === "suspended") {
        await deleteSessionsForUser(id);
      }

      return json({ user: toUserDto(updated) });
    } catch (err) {
      return authErrorResponse(err);
    }
  });
}
