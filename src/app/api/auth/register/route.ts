import { ApiErrors } from "@/lib/api";

export async function POST() {
  return ApiErrors.forbidden(
    "Self-service account creation is disabled. Please ask an admin to create your account."
  );
}
