alter table public.zap_jobs add column contact_name text not null default '' check (length(contact_name) <= 100);
alter table public.zap_jobs add column save_contact boolean not null default false;
alter table public.zap_devices add column monitor_seen timestamptz;
alter table public.zap_devices add column monitor_complete boolean not null default false;
create table public.zap_replies (
 id bigint generated always as identity primary key,
 device_id uuid not null references public.zap_devices(id),
 sender text not null,
 recipient text not null,
 message_id text not null check (length(message_id) between 1 and 250),
 received_at timestamptz not null,
 captured_at timestamptz not null default now(),
 type text not null,
 text text not null check (length(text) <= 10000),
 unique(device_id,sender,message_id)
);
create index zap_replies_device_cursor on public.zap_replies(device_id,id);
create index zap_jobs_reply_lookup on public.zap_jobs(device_id,sender,recipient,created_at);
alter table public.zap_replies enable row level security;
revoke all on public.zap_replies from anon, authenticated;
grant select,insert,update,delete on public.zap_replies to service_role;
grant usage,select on sequence public.zap_replies_id_seq to service_role;
