"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutLink() {
  const router = useRouter();
  return (
    <a
      href="/logout"
      onClick={async (e) => {
        e.preventDefault();
        await authClient.signOut();
        router.push("/?notice=Signed+out+successfully.");
        router.refresh();
      }}
    >
      Log out
    </a>
  );
}
