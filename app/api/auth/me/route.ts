import { getSessionUserFromRequest } from "@/lib/auth/get-session";
import { toUserDto, getUserById } from "@/lib/db/queries-users";
import { error, handleRoute, json } from "@/lib/api";

export async function GET(req: Request) {
  return handleRoute(async () => {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) return error("Unauthorized", 401);
    const user = await getUserById(sessionUser.id);
    if (!user) return error("Unauthorized", 401);
    return json({ user: toUserDto(user) });
  });
}
