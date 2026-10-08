import { createAuthClient } from "better-auth/react";

export const authFormateurClient = createAuthClient({
  basePath: "/api/auth-formateur",
});
