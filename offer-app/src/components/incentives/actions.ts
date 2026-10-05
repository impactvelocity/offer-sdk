import { api, ApiError } from "@/lib/api/client";

const PER_PAGE = 100;
const BATCH = 10;

/** Ids of every account that currently has this incentive. */
async function accountsWithIncentive(appId: string, incentiveId: string) {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const res = await api.incentives.accounts(appId, incentiveId, page, PER_PAGE);
    ids.push(...res.data.map((a) => a.namespace_id || a.id));
    if (res.data.length < PER_PAGE || ids.length >= res.total) break;
  }
  return ids;
}

/**
 * The API doesn't cascade incentive deletes (accounts would keep a dangling id), so remove it
 * from every account first. Ids are collected up front because the search index shrinks as we go.
 */
export async function deleteIncentive(appId: string, incentiveId: string) {
  const ids = await accountsWithIncentive(appId, incentiveId);
  for (let i = 0; i < ids.length; i += BATCH) {
    await Promise.all(
      ids.slice(i, i + BATCH).map((id) =>
        api.accounts.removeIncentive(appId, id).catch((e) => {
          // The search index is eventually consistent: an account deleted a moment ago is fine to skip.
          if (!(e instanceof ApiError && e.status === 404)) throw e;
        }),
      ),
    );
  }
  return api.incentives.delete(appId, incentiveId);
}
