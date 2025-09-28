
-- Users 
create table profiles ( 
id uuid primary key default gen_random_uuid(), 
email text unique not null, 
full_name text not null, 
timezone text not null,        -- IANA tz, e.g. "America/New_York" 
marketing_opt_in boolean not null default true, 
created_at timestamptz not null default now() 
); 

-- Product events 
create table app_events ( 
id uuid primary key default gen_random_uuid(), 
user_id uuid not null references profiles(id) on delete cascade, 
type text not null,            -- 'user_signed_up' | 'project_created' | 'video_published' 
meta jsonb not null default '{}', 
occurred_at timestamptz not null default now() 
); 

-- Email templates 
create table email_templates ( 
key text primary key,          -- e.g. 'welcome_day0' 
subject text not null, 
html text not null, 
updated_at timestamptz not null default now() 
); 

-- Queue 
create type email_status as enum ('pending','sending','sent','failed','canceled'); 
create table email_queue ( 
  id uuid primary key default gen_random_uuid(), 
  user_id uuid not null references profiles(id) on delete cascade, 
  template_key text not null references email_templates(key), 
  variant text, 
  payload jsonb not null default '{}', 
  send_after timestamptz not null, 
  status email_status not null default 'pending', 
  attempts int not null default 0, 
  created_at timestamptz not null default now() 
); 

-- Email events 
create table email_events ( 
  id uuid primary key default gen_random_uuid(), 
  user_id uuid not null references profiles(id) on delete cascade, 
  provider_id text, 
  type text not null,            -- 'delivered'|'open'|'click'|'bounce'|'spam'|'unsubscribe' 
  meta jsonb not null default '{}', 
  created_at timestamptz not null default now() 
); 

-- Suppressions 
create table email_suppressions ( 
  user_id uuid primary key references profiles(id) on delete cascade, 
  reason text not null, 
  created_at timestamptz not null default now() 
); 

-- Journey state 
create table email_journey_state ( 
  user_id uuid primary key references profiles(id) on delete cascade, 
  journey_key text not null,       -- 'onboarding_v1' 
  step_no int not null default 0, 
  last_advanced_at timestamptz not null default now(), 
  data jsonb not null default '{}' 
); 

-- Batch claim helper 
create or replace function claim_email_batch(batch_size int) 
returns setof email_queue 
language sql as $$ 
  with cte as ( 
    select id from email_queue 
    where status = 'pending' 
and send_after <= now() 
order by send_after asc 
limit batch_size 
for update skip locked 
) 
update email_queue q 
set status = 'sending' 
from cte 
where q.id = cte.id 
returning q.*; 
$$;
