export function resolveSelfServeRegistrationRole(existingRoles: Array<string | null | undefined>): "admin" | "user" {
  const hasAdmin = existingRoles.some((role) => String(role || "").toLowerCase() === "admin");
  return hasAdmin ? "user" : "admin";
}
