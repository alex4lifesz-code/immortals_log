import { clearAuthCookie } from "@/lib/auth";
import { apiSuccess } from "@/lib/api";

export async function POST() {
  const response = apiSuccess({ loggedOut: true });
  clearAuthCookie(response);
  return response;
}
