"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

// Ties dashboard events to the signed-in admin, and starts a fresh person on sign-out.
export function PostHogIdentify() {
  const { data, isPending } = useSession();
  const user = data?.user;

  useEffect(() => {
    if (isPending || !posthog.__loaded) return;
    if (user) posthog.identify(user.id, { email: user.email, name: user.name });
    else if (posthog._isIdentified()) posthog.reset();
  }, [isPending, user?.id, user?.email, user?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
