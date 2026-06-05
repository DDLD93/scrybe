import {
  clearSessionCookie,
  destroySession,
  getSessionTokenFromRequest,
} from "@/lib/auth/session";
import { handleRoute, json } from "@/lib/api";

export async function POST(req: Request) {
  return handleRoute(async () => {
    const token = await getSessionTokenFromRequest(req);
    await destroySession(token);
    await clearSessionCookie();
    return json({ ok: true });
  });
}
