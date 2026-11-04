-- Run this in Supabase SQL Editor AFTER creating the owner's Auth user.
-- Replace the placeholder with the exact email used for that Auth account.
insert into private.aida_admins (user_id)
select id
from auth.users
where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict (user_id) do nothing;
