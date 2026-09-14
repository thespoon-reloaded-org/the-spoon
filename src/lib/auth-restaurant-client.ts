import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

import type { authRestaurant } from "./auth";

export const authRestaurantClient = createAuthClient({
  basePath: "/api/auth-restaurant",
  plugins: [inferAdditionalFields<typeof authRestaurant>()],
});
