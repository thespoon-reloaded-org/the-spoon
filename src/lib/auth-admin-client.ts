import { createAuthClient } from "better-auth/react";

export const authAdminClient = createAuthClient({
  basePath: "/api/auth-admin",
});
