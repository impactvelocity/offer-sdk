import { handleAuthRequest } from "@/server/auth";

export const dynamic = "force-dynamic";

// better-auth: handled in this process with the mock API, forwarded to the hosted API otherwise.
export { handleAuthRequest as GET, handleAuthRequest as POST };
