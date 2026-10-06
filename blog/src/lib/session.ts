import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export const currentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/** `before_action :authenticate_user!` */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
