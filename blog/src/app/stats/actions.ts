"use server";

import { flashing } from "@/lib/actions";
import { offerApi } from "@/lib/offer/client";

export async function saveReport(form: FormData) {
  const api = await offerApi();
  const interval = String(form.get("interval") || "30d");
  await flashing(`/stats?interval=${interval}`, "Report saved.", () =>
    api.post("/analytics/reports", { name: String(form.get("name") || "Posts and comments"), entitlements: ["posts", "comments"], interval }),
  );
}

export async function deleteReport(id: string) {
  const api = await offerApi();
  await flashing("/stats", "Report deleted.", () => api.del(`/analytics/reports/${id}`));
}
