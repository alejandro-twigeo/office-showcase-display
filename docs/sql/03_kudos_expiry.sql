-- Kudos stay on the TV for a set number of days (7 by default, changeable with arrows).
-- Existing kudos get 7 days from when they were posted. Nothing else changes.
alter table public.positive_messages add column if not exists expires_at timestamptz;
update public.positive_messages set expires_at = created_at + interval '7 days' where expires_at is null;
