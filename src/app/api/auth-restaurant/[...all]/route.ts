import { toNextJsHandler } from "better-auth/next-js";

import { authRestaurant } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(authRestaurant);
