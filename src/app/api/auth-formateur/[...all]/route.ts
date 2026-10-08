import { toNextJsHandler } from "better-auth/next-js";

import { authFormateur } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(authFormateur);
