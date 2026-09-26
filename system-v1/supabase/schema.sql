create extension if not exists pgcrypto;

create type public.app_role as enum ('teacher', 'operator', 'admin');
create type public.source_channel as enum ('jiang', 'yang', 'pengcheng', 'owned');
create type public.public_pool as enum ('A', 'B', 'C', 'owned');
create type public.teacher_type as enum ('college', 'professional', 'both');
create type public.order_state as enum ('draft', 'published', 'delisted', 'placed', 'invalid');
create type public.validity_state as enum ('unverified', 'confirmed', 'unavailable');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  school text,
  preferred_districts text[] not null default '{}',
  role public.app_role not null default 'teacher',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.channels (
  id public.source_channel primary key,
  internal_name text not null,
  pool public.public_pool not null,
  enabled boolean not null default true
);

insert into public.channels (id, internal_name, pool) values
  ('jiang', '姜老师', 'A'),
  ('yang', '杨老师', 'B'),
  ('pengcheng', '鹏程', 'C'),
  ('owned', '自有渠道', 'owned')
on conflict (id) do nothing;

-- 仅此表包含教师端可读字段；不要在这里存放手机号、门牌或机构原始文本。
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  city text not null default '',
  district text not null default '',
  address_public text not null default '',
  student_grade text not null default '',
  student_gender text not null default '',
  subjects text[] not null default '{}',
  situation text not null default '',
  schedule_text text not null default '',
  weekdays smallint[] not null default '{}',
  requirement_text text not null default '',
  teacher_type public.teacher_type not null default 'college',
  college_hourly_min numeric(8,2),
  college_hourly_max numeric(8,2),
  professional_hourly_min numeric(8,2),
  professional_hourly_max numeric(8,2),
  per_class_fee numeric(8,2),
  per_class_fee_max numeric(8,2),
  class_duration_hours numeric(4,2),
  calculated_hourly_min numeric(8,2),
  calculated_hourly_max numeric(8,2),
  pool public.public_pool not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.order_private_data (
  order_id uuid primary key references public.orders(id) on delete cascade,
  source_channel public.source_channel not null,
  address_internal text not null default '',
  raw_text text not null,
  structured_data jsonb not null default '{}'::jsonb,
  internal_note text not null default '',
  state public.order_state not null default 'draft',
  validity public.validity_state not null default 'unverified',
  last_confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  current_stage text not null default '未设置',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  source_channel public.source_channel not null,
  created_by uuid references auth.users(id) on delete set null,
  input_count integer not null default 0,
  published_count integer not null default 0,
  updated_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.batch_orders (
  batch_id uuid not null references public.upload_batches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'unchanged', 'skipped')),
  primary key (batch_id, order_id)
);

create table public.order_source_versions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  batch_id uuid references public.upload_batches(id) on delete set null,
  source_channel public.source_channel not null,
  raw_text text not null,
  structured_data jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table public.order_stage_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order integer not null default 0,
  enabled boolean not null default true
);

create table public.order_stage_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stage_id uuid references public.order_stage_options(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  note text not null default '',
  changed_at timestamptz not null default now()
);

create table public.financial_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  source_channel public.source_channel not null,
  entry_type text not null check (entry_type in ('received', 'refunded', 'channel_settlement', 'teacher_deposit', 'other')),
  amount numeric(10,2) not null check (amount >= 0),
  happened_at timestamptz not null default now(),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.order_audit_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz not null default now()
);

create index orders_published_at_idx on public.orders (published_at desc);
create index orders_district_idx on public.orders (district);
create index orders_pool_idx on public.orders (pool);
create index orders_created_at_idx on public.orders (created_at desc);
create index order_private_state_idx on public.order_private_data (state, validity);
create index order_private_source_idx on public.order_private_data (source_channel);
create index order_private_created_at_idx on public.order_private_data (created_at desc);
create index orders_subjects_idx on public.orders using gin (subjects);
create index orders_weekdays_idx on public.orders using gin (weekdays);
create index upload_batches_created_at_idx on public.upload_batches (created_at desc);
create index order_source_versions_order_idx on public.order_source_versions (order_id, captured_at desc);
create index financial_records_happened_at_idx on public.financial_records (happened_at desc);
create index financial_records_source_idx on public.financial_records (source_channel, happened_at desc);

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create or replace function public.is_order_public(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.order_private_data d
    where d.order_id = p_order_id and d.state = 'published' and d.validity <> 'unavailable'
  )
$$;

revoke all on function public.is_order_public(uuid) from public;
grant execute on function public.is_order_public(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.orders enable row level security;
alter table public.order_private_data enable row level security;
alter table public.upload_batches enable row level security;
alter table public.batch_orders enable row level security;
alter table public.order_source_versions enable row level security;
alter table public.order_stage_options enable row level security;
alter table public.order_stage_history enable row level security;
alter table public.financial_records enable row level security;
alter table public.order_audit_logs enable row level security;

create policy "profiles are visible to self and staff" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_app_role() in ('operator', 'admin'));
create policy "teachers can create own teacher profile" on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'teacher');
create policy "users can update own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = 'teacher');
create policy "admins can manage profiles" on public.profiles for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "public may read published order fields" on public.orders for select to anon, authenticated
using (public.is_order_public(id));
create policy "staff can read all orders" on public.orders for select to authenticated
using (public.current_app_role() in ('operator', 'admin'));
create policy "staff can create orders" on public.orders for insert to authenticated
with check (public.current_app_role() in ('operator', 'admin'));
drop policy if exists "staff can update orders" on public.orders;
create policy "admins can edit orders" on public.orders for update to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "admins can delete orders" on public.orders for delete to authenticated
using (public.current_app_role() = 'admin');

create policy "staff only private order data" on public.order_private_data for all to authenticated
using (public.current_app_role() in ('operator', 'admin'))
with check (public.current_app_role() in ('operator', 'admin'));
create policy "staff may read channel mapping" on public.channels for select to authenticated
using (public.current_app_role() in ('operator', 'admin'));
create policy "admins manage channels" on public.channels for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "staff manage upload batches" on public.upload_batches for all to authenticated
using (public.current_app_role() in ('operator', 'admin')) with check (public.current_app_role() in ('operator', 'admin'));
create policy "staff manage batch orders" on public.batch_orders for all to authenticated
using (public.current_app_role() in ('operator', 'admin')) with check (public.current_app_role() in ('operator', 'admin'));
create policy "staff manage order source versions" on public.order_source_versions for all to authenticated
using (public.current_app_role() in ('operator', 'admin')) with check (public.current_app_role() in ('operator', 'admin'));
create policy "staff read stage options" on public.order_stage_options for select to authenticated
using (public.current_app_role() in ('operator', 'admin'));
create policy "admins manage stage options" on public.order_stage_options for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "staff manage stage history" on public.order_stage_history for all to authenticated
using (public.current_app_role() in ('operator', 'admin')) with check (public.current_app_role() in ('operator', 'admin'));
create policy "staff manage financial records" on public.financial_records for all to authenticated
using (public.current_app_role() in ('operator', 'admin')) with check (public.current_app_role() in ('operator', 'admin'));
create policy "admins read audit logs" on public.order_audit_logs for select to authenticated
using (public.current_app_role() = 'admin');

grant usage on schema public to anon, authenticated;
grant select on public.orders to anon, authenticated;
grant select on public.channels to authenticated;
grant select, insert, update, delete on public.orders, public.order_private_data, public.upload_batches,
  public.batch_orders, public.order_source_versions, public.order_stage_options, public.order_stage_history, public.financial_records,
  public.order_audit_logs, public.profiles to authenticated;

create or replace function public.create_teacher_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, school, preferred_districts, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '新老师'),
    nullif(new.raw_user_meta_data ->> 'school', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'preferred_districts', '[]'::jsonb))), '{}'),
    'teacher'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_teacher_profile();

-- Safe aggregate only; never returns order codes, addresses, requirements, or internal channel names.
create or replace function public.public_market_stats()
returns jsonb
language sql stable security definer set search_path = ''
as $$
with active as (
  select o.* from public.orders o join public.order_private_data d on d.order_id = o.id
  where d.state = 'published' and d.validity <> 'unavailable'
), today_active as (
  select * from active
  where published_at >= (date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
), pool_counts as (
  select pool, count(*) as count from active group by pool
), area_counts as (
  select district, count(*) as count from today_active where district <> '' group by district order by count desc limit 8
), all_area_counts as (
  select district, count(*) as count from active where district <> '' group by district
), subject_counts as (
  select subject_name as subject, count(*) as count from today_active cross join lateral unnest(subjects) as subject_rows(subject_name) group by subject_name order by count desc limit 8
)
select jsonb_build_object(
  'available', (select count(*) from active),
  'today_new', (select count(*) from today_active),
  'today_highest_hourly', (select max(calculated_hourly_max) from today_active),
  'pools', coalesce((select jsonb_object_agg(pool::text, count) from pool_counts), '{}'::jsonb),
  'areas', coalesce((select jsonb_agg(jsonb_build_object('name', district, 'count', count) order by count desc) from area_counts), '[]'::jsonb),
  'all_areas', coalesce((select jsonb_agg(jsonb_build_object('name', district, 'count', count) order by district) from all_area_counts), '[]'::jsonb),
  'subjects', coalesce((select jsonb_agg(jsonb_build_object('name', subject, 'count', count) order by count desc) from subject_counts), '[]'::jsonb)
);
$$;

revoke all on function public.public_market_stats() from public;
grant execute on function public.public_market_stats() to anon, authenticated;

create or replace function public.public_order_feed(
  p_offset integer default 0,
  p_limit integer default 10,
  p_query text default '',
  p_pool text default null,
  p_districts text[] default null,
  p_subjects text[] default null,
  p_teacher_type text default null,
  p_min_hourly numeric default null,
  p_max_hourly numeric default null,
  p_weekdays smallint[] default null,
  p_time_period text default null,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
with filtered as (
  select o.* from public.orders o join public.order_private_data d on d.order_id = o.id
  where d.state = 'published' and d.validity <> 'unavailable'
    and (p_pool is null or o.pool::text = p_pool)
    and (coalesce(array_length(p_districts, 1), 0) = 0 or o.district = any(p_districts))
    and (coalesce(array_length(p_subjects, 1), 0) = 0 or o.subjects && p_subjects)
    and (coalesce(p_query, '') = '' or strpos(lower(concat_ws(' ', o.order_code, o.city, o.district,
      o.address_public, o.student_grade, array_to_string(o.subjects, ' '), o.situation, o.schedule_text,
      o.requirement_text)), lower(p_query)) > 0)
    and (p_since is null or o.published_at >= p_since)
    and (p_until is null or o.published_at < p_until)
    and (coalesce(array_length(p_weekdays, 1), 0) = 0 or o.weekdays && p_weekdays)
    and (p_time_period is null or o.schedule_text ilike '%' || p_time_period || '%')
    and (p_teacher_type is null or
      (p_teacher_type = 'college' and o.teacher_type in ('college', 'both')) or
      (p_teacher_type = 'professional' and o.teacher_type in ('professional', 'both')))
    and ((p_min_hourly is null and p_max_hourly is null) or
      case
        when p_teacher_type = 'college' then
          coalesce(o.college_hourly_max, o.calculated_hourly_max) is not null
          and (p_min_hourly is null or coalesce(o.college_hourly_max, o.calculated_hourly_max) >= p_min_hourly)
          and (p_max_hourly is null or coalesce(o.college_hourly_min, o.calculated_hourly_min) <= p_max_hourly)
        when p_teacher_type = 'professional' then
          coalesce(o.professional_hourly_max, o.calculated_hourly_max) is not null
          and (p_min_hourly is null or coalesce(o.professional_hourly_max, o.calculated_hourly_max) >= p_min_hourly)
          and (p_max_hourly is null or coalesce(o.professional_hourly_min, o.calculated_hourly_min) <= p_max_hourly)
        else
          (o.college_hourly_max is not null and (p_min_hourly is null or o.college_hourly_max >= p_min_hourly) and (p_max_hourly is null or o.college_hourly_min <= p_max_hourly))
          or (o.professional_hourly_max is not null and (p_min_hourly is null or o.professional_hourly_max >= p_min_hourly) and (p_max_hourly is null or o.professional_hourly_min <= p_max_hourly))
          or (o.calculated_hourly_max is not null and (p_min_hourly is null or o.calculated_hourly_max >= p_min_hourly) and (p_max_hourly is null or o.calculated_hourly_min <= p_max_hourly))
      end)
), page_rows as (
  select jsonb_build_object(
    'id', id, 'order_code', order_code, 'city', city, 'district', district,
    'address_public', address_public, 'student_grade', student_grade,
    'student_gender', student_gender, 'subjects', subjects, 'situation', situation,
    'schedule_text', schedule_text, 'weekdays', weekdays, 'requirement_text', requirement_text,
    'teacher_type', teacher_type, 'college_hourly_min', college_hourly_min,
    'college_hourly_max', college_hourly_max, 'professional_hourly_min', professional_hourly_min,
    'professional_hourly_max', professional_hourly_max, 'per_class_fee', per_class_fee,
    'per_class_fee_max', per_class_fee_max, 'class_duration_hours', class_duration_hours,
    'calculated_hourly_min', calculated_hourly_min, 'calculated_hourly_max', calculated_hourly_max,
    'pool', pool, 'published_at', published_at
  ) as item
  from filtered order by published_at desc nulls last, created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50)) offset greatest(coalesce(p_offset, 0), 0)
)
select jsonb_build_object(
  'total', (select count(*) from filtered),
  'orders', coalesce((select jsonb_agg(item) from page_rows), '[]'::jsonb)
);
$$;

revoke all on function public.public_order_feed(integer, integer, text, text, text[], text[], text, numeric, numeric, smallint[], text, timestamptz, timestamptz) from public;
grant execute on function public.public_order_feed(integer, integer, text, text, text[], text[], text, numeric, numeric, smallint[], text, timestamptz, timestamptz) to anon, authenticated;

create or replace function public.public_recent_uploads()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'created_at', recent.created_at,
    'published_count', recent.published_count,
    'pool', recent.pool
  ) order by recent.created_at desc), '[]'::jsonb)
  from (
    select b.created_at, b.published_count, c.pool
    from public.upload_batches b
    join public.channels c on c.id = b.source_channel
    where b.published_count > 0
    order by b.created_at desc
    limit 8
  ) as recent;
$$;

revoke all on function public.public_recent_uploads() from public;
grant execute on function public.public_recent_uploads() to anon, authenticated;

create or replace function public.internal_dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  today_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai');
  month_start timestamptz := (date_trunc('month', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai');
begin
  if public.current_app_role() not in ('operator', 'admin') then
    raise exception 'Internal role required';
  end if;

  return (
    with order_data as (
      select o.*, d.source_channel, d.state, d.validity, d.created_at as recorded_at
      from public.orders o join public.order_private_data d on d.order_id = o.id
    ),
    channel_counts as (
      select c.internal_name as name,
        count(*) filter (where d.recorded_at >= today_start) as today,
        count(*) filter (where d.recorded_at >= now() - interval '7 days') as days_7,
        count(*) filter (where d.recorded_at >= now() - interval '12 days') as days_12,
        count(*) filter (where d.recorded_at >= now() - interval '30 days') as days_30
      from public.channels c left join order_data d on d.source_channel = c.id
      group by c.internal_name
    ),
    region_counts as (
      select district as name, count(*) as count from order_data
      where recorded_at >= now() - interval '30 days' and district <> ''
      group by district order by count desc limit 10
    ),
    subject_counts as (
      select subject_name as name, count(*) as count from order_data cross join lateral unnest(subjects) as subject_rows(subject_name)
      where recorded_at >= now() - interval '30 days'
      group by subject_name order by count desc limit 10
    ),
    rate_counts as (
      select case
        when calculated_hourly_max is null then '未标价'
        when calculated_hourly_max < 60 then '60以下'
        when calculated_hourly_max < 80 then '60–80'
        when calculated_hourly_max < 100 then '80–100'
        when calculated_hourly_max < 150 then '100–150'
        when calculated_hourly_max < 200 then '150–200'
        else '200+'
      end as name, count(*) as count
      from order_data where recorded_at >= now() - interval '30 days'
      group by 1
    ),
    status_counts as (
      select state::text as name, count(*) as count from order_data group by state
    ),
    finance as (
      select
        coalesce(sum(amount) filter (where entry_type = 'received'), 0) as received,
        coalesce(sum(amount) filter (where entry_type = 'refunded'), 0) as refunded,
        coalesce(sum(amount) filter (where entry_type = 'channel_settlement'), 0) as channel_settlement,
        coalesce(sum(amount) filter (where entry_type = 'teacher_deposit'), 0) as teacher_deposit
      from public.financial_records where happened_at >= month_start
    )
    select jsonb_build_object(
      'today', (select count(*) from order_data where recorded_at >= today_start),
      'current_available', (select count(*) from order_data where state = 'published' and validity <> 'unavailable'),
      'today_delisted', (select count(*) from order_data where recorded_at >= today_start and state in ('delisted','invalid','placed')),
      'month_orders', (select count(*) from order_data where recorded_at >= month_start),
      'channels', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'today', today, 'days_7', days_7, 'days_12', days_12, 'days_30', days_30) order by today desc) from channel_counts), '[]'::jsonb),
      'regions', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', count) order by count desc) from region_counts), '[]'::jsonb),
      'subjects', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', count) order by count desc) from subject_counts), '[]'::jsonb),
      'salary', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', count) order by case name when '60以下' then 1 when '60–80' then 2 when '80–100' then 3 when '100–150' then 4 when '150–200' then 5 when '200+' then 6 else 7 end) from rate_counts), '[]'::jsonb),
      'states', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', count)) from status_counts), '[]'::jsonb),
      'finance_month', (select to_jsonb(finance) from finance)
    )
  );
end;
$$;

revoke all on function public.internal_dashboard_stats() from public;
grant execute on function public.internal_dashboard_stats() to authenticated;
