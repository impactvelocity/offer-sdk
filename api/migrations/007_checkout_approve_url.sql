-- PayPal's approval link for a checkout, so an open checkout can be handed out
-- again (e.g. in repeated over-limit responses) instead of starting a new one.
alter table checkouts add column approve_url text;
create index checkouts_open_idx on checkouts (app_id, account_id, created_at desc) where status = 'created';
