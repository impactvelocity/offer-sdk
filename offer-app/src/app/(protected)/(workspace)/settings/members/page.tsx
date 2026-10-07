import { redirect } from "next/navigation";

// One admin account per install for now (see /setup), so the members page is hidden.
// MembersView stays for when teams come back.
export default function MembersPage() {
  redirect("/settings/workspace");
}
