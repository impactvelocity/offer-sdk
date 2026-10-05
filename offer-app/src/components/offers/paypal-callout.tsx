"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { usePaypal } from "@/lib/api/hooks";

/** Shown until PayPal is connected: offers can't be published or bought without it. */
export function PaypalCallout({ appId, className }: { appId: string; className?: string }) {
  const { data } = usePaypal(appId);
  if (!data || data.connected) return null;
  return (
    <Callout
      tone="warning"
      className={className}
      action={
        <Link href={`/apps/${appId}/settings#payments`} className={buttonVariants({ size: "sm" })}>
          Connect PayPal
        </Link>
      }
    >
      Connect PayPal to publish offers and take payments.
    </Callout>
  );
}
