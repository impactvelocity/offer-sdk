import "server-only";
import { redirect } from "next/navigation";
import { withNotice } from "@/components/flash";
import { OfferApiError } from "@/lib/offer/client";

/** Runs one API call from a form, then redirects back with the result as the flash. */
export async function flashing(back: string, success: string, fn: () => Promise<unknown>): Promise<never> {
  try {
    await fn();
  } catch (err) {
    if (!(err instanceof OfferApiError)) throw err;
    redirect(withNotice(back, `${err.status}: ${err.message}`, "alert"));
  }
  redirect(withNotice(back, success));
}
