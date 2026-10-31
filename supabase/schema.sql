-- Instalacao inicial; acesso de dados somente pela Edge Function autenticada.
create table public.zap_devices (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 worker_hash text not null unique,
 controller_hash text not null unique,
 sender text,
 last_seen timestamptz,
 enabled boolean not null default true
);
create table public.zap_jobs (
 id uuid primary key,
 device_id uuid not null references public.zap_devices(id),
 sender text not null check (sender ~ '^[0-9]{12,15}$'),
 recipient text not null check (recipient ~ '^[0-9]{12,15}$'),
 message text not null check (length(message) between 1 and 10000),
 status text not null default 'queued' check (status in ('queued','running','sent','failed','uncertain','cancelled')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '1 hour',
 finished_at timestamptz,
 detail text
);
create index zap_jobs_device_created on public.zap_jobs(device_id,created_at);
create unique index zap_jobs_one_running on public.zap_jobs(device_id) where status = 'running';
alter table public.zap_devices enable row level security;
alter table public.zap_jobs enable row level security;
revoke all on public.zap_devices, public.zap_jobs from anon, authenticated;
grant select,insert,update,delete on public.zap_devices, public.zap_jobs to service_role;
