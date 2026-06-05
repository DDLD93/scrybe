import { countUsers } from "@/lib/db/queries-users";
import { getSessionUserFromRequest } from "@/lib/auth/get-session";
import { handleRoute, json } from "@/lib/api";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const hasUsers = (await countUsers()) > 0;
    const user = await getSessionUserFromRequest(req);
    return json({
      hasUsers,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            permissions: user.permissions,
            status: user.status,
            mustChangePassword: user.mustChangePassword,
          }
        : null,
    });
  });
}
