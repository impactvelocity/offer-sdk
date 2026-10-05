import type { Metadata } from "next";
import { AccountDetail } from "./account-detail";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ params }: PageProps<"/apps/[appId]/accounts/[accountId]">) {
  const { accountId } = await params;
  return <AccountDetail accountId={decodeURIComponent(accountId)} />;
}
