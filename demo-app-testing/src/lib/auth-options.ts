import type { BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db, dialect } from "@/db";

// Kept apart from auth.ts so the migrator (instrumentation.ts) can read the
// schema without starting better-auth, which checks tables on start.

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is not set");

export const authOptions = {
  appName: "Blog",
  baseURL: process.env.BLOG_URL ?? "http://localhost:6770",
  secret: secret ?? "blog-dev-secret-not-for-production-use-0000",
  database: { db, type: dialect },
  emailAndPassword: { enabled: true, minPasswordLength: 6 },
  plugins: [nextCookies()],
} satisfies BetterAuthOptions;
