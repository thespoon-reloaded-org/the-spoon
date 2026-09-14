import { toNextJsHandler } from "better-auth/next-js";

import { authAdmin } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(authAdmin);
