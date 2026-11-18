import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { handleApi, json } from "../../../lib/server/api";

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  try {
    const user = await getChatGPTUser();
    return await handleApi(request, {
      db: env.DB,
      user: user ? { userId: user.userId } : null,
      moderatorUserIds: env.FITLOG_MODERATOR_USER_IDS,
    });
  } catch {
    return json({ error: "로그인 정보를 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.", code: "SESSION_UNAVAILABLE" }, 503);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
