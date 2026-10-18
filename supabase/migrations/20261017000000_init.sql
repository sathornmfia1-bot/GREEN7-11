-- =============================================================================
-- LawnFlow — โครงสร้างฐานข้อมูลเริ่มต้น (อ้างอิง database.md)
-- รันใน Supabase: SQL Editor → วางไฟล์นี้ทั้งไฟล์ → Run
-- หรือใช้ Supabase CLI: supabase db push
--
-- ความต่างจาก database.md:
--   - public.users อ้างอิง auth.users (Supabase Auth จัดการรหัสผ่านและ OTP แทน
--     คอลัมน์ password_hash และตาราง otp_codes)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2. Enum
-- -----------------------------------------------------------------------------
create type user_role             as enum ('customer', 'mechanic', 'admin');
create type user_status           as enum ('active', 'suspended');
create type verification_status   as enum ('pending_verification', 'verified', 'rejected');
create type pricing_mode          as enum ('single', 'monthly');
create type booking_status        as enum ('pending_payment', 'paid', 'cancelled', 'completed');
create type cycle_status          as enum ('upcoming', 'active', 'completed', 'refunded');
create type job_status            as enum ('open', 'matched', 'arrived', 'working', 'completed', 'closed', 'cancelled');
create type cancelled_by          as enum ('customer', 'mechanic', 'admin', 'system');
create type photo_kind            as enum ('before', 'after');
create type adjustment_decision   as enum ('pending', 'accepted', 'rejected', 'expired');
create type adjustment_settlement as enum ('awaiting_payment', 'paid_difference', 'refunded', 'no_change');
create type payment_type          as enum ('booking', 'adjustment_difference');
create type payment_status        as enum ('pending', 'paid', 'failed', 'expired');
create type refund_reason         as enum ('customer_cancel', 'price_decrease', 'subscription_cancel', 'admin');
create type refund_status         as enum ('requested', 'processing', 'completed', 'failed');
create type settlement_status     as enum ('held', 'released', 'refunded');
create type payout_status         as enum ('requested', 'processing', 'completed', 'failed');
create type notification_type as enum (
  'job_matched', 'mechanic_arrived', 'work_started', 'work_completed_review_request',
  'adjustment_requested', 'adjustment_accepted', 'adjustment_rejected', 'adjustment_expired', 'adjustment_difference_paid',
  'job_cancelled_by_customer', 'job_cancelled_by_mechanic', 'refund_completed',
  'payout_completed', 'verification_approved', 'verification_rejected',
  'rain_rescheduled', 'rematched'
);

-- อัปเดต updated_at อัตโนมัติ
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. ผู้ใช้
-- -----------------------------------------------------------------------------
create table users (
  id              uuid primary key references auth.users (id) on delete cascade,
  role            user_role   not null default 'customer',
  first_name      varchar(100) not null,
  last_name       varchar(100) not null,
  phone           varchar(10)  not null unique check (phone ~ '^0[0-9]{9}$'),
  phone_verified  boolean      not null default false,
  email           varchar(255) unique,
  status          user_status  not null default 'active',
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);
create trigger users_updated_at before update on users for each row execute function set_updated_at();

create table service_addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  label         varchar(50)  not null,
  address_line  text         not null,
  province      varchar(100) not null,
  amphoe        varchar(100) not null,
  district      varchar(100),
  zipcode       char(5),
  lat           numeric(9,6),
  lng           numeric(9,6),
  is_default    boolean      not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);
create unique index service_addresses_one_default on service_addresses (user_id) where is_default and deleted_at is null;
create index service_addresses_user_idx on service_addresses (user_id) where deleted_at is null;
create trigger service_addresses_updated_at before update on service_addresses for each row execute function set_updated_at();

create table customer_profiles (
  user_id                     uuid primary key references users (id) on delete cascade,
  default_service_address_id  uuid references service_addresses (id),
  preferred_contact_method    varchar(20) not null default 'phone',
  accepted_terms_at           timestamptz not null default now()
);

create table mechanic_profiles (
  user_id                  uuid primary key references users (id) on delete cascade,
  photo_url                text         not null,
  id_card_image_url        text         not null,
  bank_name                varchar(100) not null,
  bank_account_number_enc  bytea        not null,   -- เข้ารหัสฝั่งเซิร์ฟเวอร์ก่อนบันทึก
  bank_account_last4       char(4)      not null,
  bank_account_name        varchar(200) not null,
  service_radius_km        smallint     not null check (service_radius_km in (5, 10, 20, 30, 50)),
  base_address_line        text         not null,
  base_province            varchar(100) not null,
  base_amphoe              varchar(100) not null,
  base_district            varchar(100),
  base_zipcode             char(5),
  base_lat                 numeric(9,6) not null,   -- บังคับปักหมุด ใช้คำนวณระยะทาง
  base_lng                 numeric(9,6) not null,
  verification_status      verification_status not null default 'pending_verification',
  reject_reason            text,
  reviewed_by              uuid references users (id),
  reviewed_at              timestamptz,
  vip_status               boolean      not null default false,
  rating_average           numeric(2,1) not null default 0,
  rating_count             integer      not null default 0,
  completed_jobs_count     integer      not null default 0,
  accepted_terms_at        timestamptz  not null default now(),
  submitted_at             timestamptz  not null default now(),
  constraint reject_needs_reason check (verification_status <> 'rejected' or reject_reason is not null)
);
create index mechanic_profiles_verification_idx on mechanic_profiles (verification_status);

-- -----------------------------------------------------------------------------
-- 4. ตารางราคา
-- -----------------------------------------------------------------------------
create table service_types (
  code          varchar(40) primary key,
  name          varchar(100)  not null,
  base_price    numeric(12,2) not null,
  base_area_wa  integer       not null default 100,
  extra_per_wa  numeric(12,2) not null,
  sort_order    smallint      not null,
  is_active     boolean       not null default true
);

create table grass_height_levels (
  level       smallint primary key,
  label       varchar(50)  not null,
  multiplier  numeric(4,2) not null
);

create table monthly_packages (
  code                  varchar(40) primary key,
  name                  varchar(100) not null,
  visits_per_month      smallint,
  pricing_service_code  varchar(40) references service_types (code),
  discount_percent      numeric(5,2) not null default 0,
  fixed_monthly_price   numeric(12,2),
  sort_order            smallint not null
);

create table platform_settings (
  key         varchar(60) primary key,
  value       jsonb not null,
  updated_by  uuid references users (id),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. การจองและงาน
-- -----------------------------------------------------------------------------
create table bookings (
  id                      uuid primary key default gen_random_uuid(),
  customer_id             uuid not null references users (id),
  service_address_id      uuid not null references service_addresses (id),
  pricing_mode            pricing_mode not null,
  service_type_code       varchar(40) references service_types (code),
  monthly_package_code    varchar(40) references monthly_packages (code),
  prepaid_months          smallint check (prepaid_months in (3, 6, 12)),
  area_sq_wah             integer check (area_sq_wah > 0),
  grass_height_level      smallint references grass_height_levels (level),
  first_appointment_date  date not null,
  unit_price              numeric(12,2) not null,
  total_amount            numeric(12,2) not null,
  price_breakdown         jsonb not null default '{}'::jsonb,
  status                  booking_status not null default 'pending_payment',
  cancelled_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint booking_mode_fields check (
    (pricing_mode = 'single'  and service_type_code is not null and monthly_package_code is null and prepaid_months is null) or
    (pricing_mode = 'monthly' and monthly_package_code is not null and prepaid_months is not null)
  )
);
create index bookings_customer_idx on bookings (customer_id, created_at desc);
create trigger bookings_updated_at before update on bookings for each row execute function set_updated_at();

create table booking_photos (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings (id) on delete cascade,
  url         text not null,
  sort_order  smallint not null,
  created_at  timestamptz not null default now()
);

create table subscription_cycles (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings (id) on delete cascade,
  cycle_no     smallint not null,
  cycle_month  date not null,
  mechanic_id  uuid references users (id),   -- ช่างคนเดียวรับงานทั้งเดือน
  accepted_at  timestamptz,
  amount       numeric(12,2) not null,
  status       cycle_status not null default 'upcoming',
  started_at   timestamptz,
  ended_at     timestamptz
);
create unique index subscription_cycles_unique on subscription_cycles (booking_id, cycle_no);

create table jobs (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references bookings (id),
  cycle_id              uuid references subscription_cycles (id),
  customer_id           uuid not null references users (id),
  mechanic_id           uuid references users (id),
  title                 varchar(100),
  is_monthly            boolean not null,
  service_name          varchar(150) not null,
  service_type_code     varchar(40) references service_types (code),
  area_sq_wah           integer not null,
  grass_height_level    smallint not null references grass_height_levels (level),
  appointment_date      date not null,
  appointment_time      time,
  address_line          text not null,
  province              varchar(100) not null,
  amphoe                varchar(100) not null,
  district              varchar(100),
  zipcode               char(5),
  lat                   numeric(9,6),
  lng                   numeric(9,6),
  quote_amount          numeric(12,2) not null,
  extra_charges         numeric(12,2) not null default 0,
  final_amount          numeric(12,2) not null,
  platform_fee_percent  numeric(5,2) not null,
  status                job_status not null default 'open',
  visible_to_vip_at     timestamptz not null default now(),
  visible_to_all_at     timestamptz not null default now() + interval '30 seconds',
  accepted_at           timestamptz,
  arrived_at            timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  closed_at             timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          cancelled_by,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint mechanic_required_after_open check (status in ('open', 'cancelled') or mechanic_id is not null)
);
-- ช่างรับงานได้วันละ 1 งาน
create unique index jobs_one_per_mechanic_per_day on jobs (mechanic_id, appointment_date)
  where mechanic_id is not null and status <> 'cancelled';
create index jobs_pool_idx     on jobs (appointment_date, appointment_time) where status = 'open';
create index jobs_mechanic_idx on jobs (mechanic_id, appointment_date);
create index jobs_customer_idx on jobs (customer_id, appointment_date desc);
create trigger jobs_updated_at before update on jobs for each row execute function set_updated_at();

create table job_status_history (
  id           bigserial primary key,
  job_id       uuid not null references jobs (id) on delete cascade,
  from_status  job_status,
  to_status    job_status not null,
  changed_by   uuid references users (id),
  note         text,
  created_at   timestamptz not null default now()
);

-- บันทึก timeline อัตโนมัติเมื่อสถานะงานเปลี่ยน
create or replace function log_job_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into job_status_history (job_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger jobs_status_history after insert or update of status on jobs for each row execute function log_job_status();

-- -----------------------------------------------------------------------------
-- 6. ตรวจงานและปรับราคา
-- -----------------------------------------------------------------------------
create table inspection_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs (id) on delete cascade,
  kind         photo_kind not null,
  url          text not null,
  uploaded_by  uuid not null references users (id),
  created_at   timestamptz not null default now()
);

create table ai_inspections (
  id                           uuid primary key default gen_random_uuid(),
  job_id                       uuid not null references jobs (id) on delete cascade,
  before_photo_id              uuid references inspection_photos (id),
  after_photo_id               uuid references inspection_photos (id),
  completeness_percent         smallint,
  estimated_area_sq_wah        integer,
  detected_grass_height_level  smallint references grass_height_levels (level),
  estimated_debris_hours       smallint,
  model_version                varchar(50),
  raw_result                   jsonb,
  created_at                   timestamptz not null default now()
);

create table quote_adjustments (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid not null references jobs (id) on delete cascade,
  requested_by            uuid not null references users (id),
  ai_inspection_id        uuid references ai_inspections (id),
  old_amount              numeric(12,2) not null,
  new_amount              numeric(12,2) not null check (new_amount <> old_amount),
  new_area_sq_wah         integer not null,
  new_grass_height_level  smallint not null references grass_height_levels (level),
  debris_hours            smallint not null default 0,
  new_extra_charges       numeric(12,2) not null,
  reasons                 text[] not null,
  note                    text,
  customer_decision       adjustment_decision not null default 'pending',
  settlement              adjustment_settlement,
  decided_at              timestamptz,
  expires_at              timestamptz not null default now() + interval '1 hour',
  created_at              timestamptz not null default now()
);
create unique index quote_adjustments_one_open on quote_adjustments (job_id)
  where customer_decision = 'pending' or settlement = 'awaiting_payment';

-- -----------------------------------------------------------------------------
-- 7. การเงิน
-- -----------------------------------------------------------------------------
create table payments (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references bookings (id),
  quote_adjustment_id  uuid references quote_adjustments (id),
  payer_id             uuid not null references users (id),
  type                 payment_type not null,
  amount               numeric(12,2) not null check (amount > 0),
  currency             char(3) not null default 'THB',
  method               varchar(30) not null default 'promptpay_qr',
  qr_reference         varchar(100) unique,
  status               payment_status not null default 'pending',
  paid_at              timestamptz,
  created_at           timestamptz not null default now()
);

create table refunds (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references bookings (id),
  job_id                   uuid references jobs (id),
  quote_adjustment_id      uuid references quote_adjustments (id),
  customer_id              uuid not null references users (id),
  reason                   refund_reason not null,
  amount                   numeric(12,2) not null check (amount > 0),
  bank_name                varchar(100),
  bank_account_number_enc  bytea,
  bank_account_last4       char(4),
  bank_account_name        varchar(200),
  status                   refund_status not null default 'requested',
  processed_at             timestamptz,
  created_at               timestamptz not null default now()
);

create table job_settlements (
  job_id                uuid primary key references jobs (id),
  mechanic_id           uuid not null references users (id),
  gross_amount          numeric(12,2) not null,
  platform_fee          numeric(12,2) not null,
  net_amount            numeric(12,2) not null,
  status                settlement_status not null default 'held',
  release_available_at  timestamptz not null,
  released_at           timestamptz,
  constraint settlement_math check (net_amount = gross_amount - platform_fee)
);
create index job_settlements_mechanic_idx on job_settlements (mechanic_id, status);

create table payouts (
  id                  uuid primary key default gen_random_uuid(),
  mechanic_id         uuid not null references users (id),
  job_id              uuid not null unique references job_settlements (job_id),
  amount              numeric(12,2) not null,
  bank_name           varchar(100) not null,
  bank_account_last4  char(4) not null,
  bank_account_name   varchar(200) not null,
  status              payout_status not null default 'requested',
  transfer_reference  varchar(100),
  requested_at        timestamptz not null default now(),
  transferred_at      timestamptz
);

-- -----------------------------------------------------------------------------
-- 8. รีวิว แจ้งเตือน และ audit log
-- -----------------------------------------------------------------------------
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null unique references jobs (id),
  customer_id  uuid not null references users (id),
  mechanic_id  uuid not null references users (id),
  rating       smallint not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);

-- อัปเดตเรทติ้งเฉลี่ยของช่างเมื่อมีรีวิวใหม่
create or replace function refresh_mechanic_rating() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update mechanic_profiles m
  set rating_average = coalesce((select round(avg(rating)::numeric, 1) from reviews where mechanic_id = new.mechanic_id), 0),
      rating_count   = (select count(*) from reviews where mechanic_id = new.mechanic_id)
  where m.user_id = new.mechanic_id;
  return new;
end $$;
create trigger reviews_refresh_rating after insert on reviews for each row execute function refresh_mechanic_rating();

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  type        notification_type not null,
  title       varchar(200) not null,
  body        text,
  job_id      uuid references jobs (id) on delete set null,
  data        jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_unread_idx on notifications (user_id, created_at desc) where read_at is null;

create table admin_audit_logs (
  id           bigserial primary key,
  admin_id     uuid not null references users (id),
  action       varchar(60) not null,
  target_type  varchar(40),
  target_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 9. View สำหรับรายงาน (security_invoker = ใช้สิทธิ์ RLS ของผู้เรียก)
-- -----------------------------------------------------------------------------
create view mechanic_earnings with (security_invoker = true) as
select s.mechanic_id,
       j.completed_at::date as work_date,
       j.id                 as job_id,
       j.service_name,
       j.area_sq_wah,
       s.net_amount,
       s.status             as money_status,
       (r.id is not null)   as reviewed,
       r.rating
from job_settlements s
join jobs j          on j.id = s.job_id
left join reviews r  on r.job_id = j.id;

create view platform_revenue with (security_invoker = true) as
select j.completed_at::date as work_date,
       j.mechanic_id,
       j.service_type_code,
       s.gross_amount,
       s.platform_fee,
       s.net_amount,
       s.status
from job_settlements s
join jobs j on j.id = s.job_id;

-- ข้อมูลช่างที่ลูกค้าเห็นบนการ์ด "ช่างของคุณ" (ไม่รวมข้อมูลธนาคาร/บัตรประชาชน)
create view mechanic_public_cards as
select m.user_id, u.first_name, u.last_name, m.photo_url,
       m.rating_average, m.rating_count, m.completed_jobs_count
from mechanic_profiles m
join users u on u.id = m.user_id
where m.verification_status = 'verified';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role = 'admin');
$$;

create or replace function current_user_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid();
$$;

create or replace function is_verified_mechanic() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from mechanic_profiles where user_id = auth.uid() and verification_status = 'verified');
$$;

alter table users               enable row level security;
alter table service_addresses   enable row level security;
alter table customer_profiles   enable row level security;
alter table mechanic_profiles   enable row level security;
alter table service_types       enable row level security;
alter table grass_height_levels enable row level security;
alter table monthly_packages    enable row level security;
alter table platform_settings   enable row level security;
alter table bookings            enable row level security;
alter table booking_photos      enable row level security;
alter table subscription_cycles enable row level security;
alter table jobs                enable row level security;
alter table job_status_history  enable row level security;
alter table inspection_photos   enable row level security;
alter table ai_inspections      enable row level security;
alter table quote_adjustments   enable row level security;
alter table payments            enable row level security;
alter table refunds             enable row level security;
alter table job_settlements     enable row level security;
alter table payouts             enable row level security;
alter table reviews             enable row level security;
alter table notifications       enable row level security;
alter table admin_audit_logs    enable row level security;

-- ตารางราคา: ทุกคนอ่านได้ (หน้าคำนวณราคาไม่ต้องล็อกอิน), แอดมินแก้ไขได้
create policy "pricing readable" on service_types       for select using (true);
create policy "pricing readable" on grass_height_levels for select using (true);
create policy "pricing readable" on monthly_packages    for select using (true);
create policy "pricing readable" on platform_settings   for select using (true);
create policy "admin manages pricing" on service_types       for all using (is_admin()) with check (is_admin());
create policy "admin manages pricing" on grass_height_levels for all using (is_admin()) with check (is_admin());
create policy "admin manages pricing" on monthly_packages    for all using (is_admin()) with check (is_admin());
create policy "admin manages pricing" on platform_settings   for all using (is_admin()) with check (is_admin());

-- ผู้ใช้: เห็นและแก้ไขเฉพาะของตัวเอง (เปลี่ยน role ไม่ได้), แอดมินเห็นทั้งหมด
create policy "own user" on users for select using (id = auth.uid() or is_admin());
create policy "insert own user" on users for insert with check (id = auth.uid() and role <> 'admin');
create policy "update own user" on users for update using (id = auth.uid())
  with check (id = auth.uid() and role = current_user_role());
create policy "admin manages users" on users for update using (is_admin());
-- ช่างเห็นชื่อ/เบอร์ลูกค้าของงานตัวเอง และชื่อลูกค้าของงานใน Job Pool
create policy "mechanic sees job customers" on users for select using (
  exists (select 1 from jobs j where j.customer_id = users.id
          and (j.mechanic_id = auth.uid() or (j.status = 'open' and is_verified_mechanic())))
);

create policy "own addresses" on service_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin reads addresses" on service_addresses for select using (is_admin());

create policy "own customer profile" on customer_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin reads customer profiles" on customer_profiles for select using (is_admin());

-- ช่าง: สมัคร/ดูของตัวเอง แต่เปลี่ยนสถานะการตรวจสอบเองไม่ได้ · แอดมินอนุมัติ
create policy "own mechanic profile" on mechanic_profiles for select using (user_id = auth.uid() or is_admin());
create policy "submit mechanic profile" on mechanic_profiles for insert
  with check (user_id = auth.uid() and verification_status = 'pending_verification');
create policy "admin reviews mechanics" on mechanic_profiles for update using (is_admin()) with check (is_admin());

-- การจอง: ลูกค้าเห็น/สร้างของตัวเอง
create policy "own bookings" on bookings for select using (customer_id = auth.uid() or is_admin());
create policy "create own booking" on bookings for insert with check (customer_id = auth.uid());

create policy "booking photos" on booking_photos for select using (
  is_admin()
  or exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid())
  or exists (select 1 from jobs j where j.booking_id = booking_photos.booking_id
             and (j.mechanic_id = auth.uid() or (j.status = 'open' and is_verified_mechanic())))
);
create policy "add booking photos" on booking_photos for insert with check (
  exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid())
);

create policy "cycles visible" on subscription_cycles for select using (
  is_admin() or mechanic_id = auth.uid()
  or exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid())
);

-- งาน: ลูกค้าเห็นงานของตัวเอง · ช่างที่อนุมัติแล้วเห็นงานใน Job Pool และงานของตัวเอง
-- การเปลี่ยนสถานะงานทำผ่านฟังก์ชัน (RPC) เท่านั้น จึงไม่มี policy update ให้ผู้ใช้ทั่วไป
create policy "jobs visible" on jobs for select using (
  is_admin() or customer_id = auth.uid() or mechanic_id = auth.uid()
  or (status = 'open' and is_verified_mechanic())
);
create policy "job history visible" on job_status_history for select using (
  is_admin() or exists (select 1 from jobs j where j.id = job_id and (j.customer_id = auth.uid() or j.mechanic_id = auth.uid()))
);

create policy "inspection photos" on inspection_photos for select using (
  is_admin() or exists (select 1 from jobs j where j.id = job_id and (j.customer_id = auth.uid() or j.mechanic_id = auth.uid()))
);
create policy "mechanic uploads inspection photos" on inspection_photos for insert with check (
  uploaded_by = auth.uid() and exists (select 1 from jobs j where j.id = job_id and j.mechanic_id = auth.uid())
);
create policy "ai inspections" on ai_inspections for select using (
  is_admin() or exists (select 1 from jobs j where j.id = job_id and (j.customer_id = auth.uid() or j.mechanic_id = auth.uid()))
);

create policy "adjustments visible" on quote_adjustments for select using (
  is_admin() or exists (select 1 from jobs j where j.id = job_id and (j.customer_id = auth.uid() or j.mechanic_id = auth.uid()))
);

-- การเงิน: อ่านได้เฉพาะผู้เกี่ยวข้อง · การสร้าง/แก้ไขทำฝั่งเซิร์ฟเวอร์ (service role) เท่านั้น
create policy "own payments"    on payments        for select using (payer_id = auth.uid() or is_admin());
create policy "own refunds"     on refunds         for select using (customer_id = auth.uid() or is_admin());
create policy "own settlements" on job_settlements for select using (mechanic_id = auth.uid() or is_admin());
create policy "own payouts"     on payouts         for select using (mechanic_id = auth.uid() or is_admin());

-- รีวิว: อ่านได้ทุกคนที่ล็อกอิน · ลูกค้ารีวิวงานของตัวเองที่เสร็จแล้ว
create policy "reviews readable" on reviews for select using (auth.uid() is not null);
create policy "customer reviews own job" on reviews for insert with check (
  customer_id = auth.uid() and exists (
    select 1 from jobs j where j.id = job_id and j.customer_id = auth.uid()
      and j.mechanic_id = reviews.mechanic_id and j.status in ('completed', 'closed')
  )
);

create policy "own notifications" on notifications for select using (user_id = auth.uid());
create policy "mark own notifications read" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admin audit logs" on admin_audit_logs for select using (is_admin());

revoke all on mechanic_public_cards from anon;
grant select on mechanic_public_cards to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: ช่างกดรับงาน (กันรับซ้ำ, ตรวจการอนุมัติ, VIP 30 วินาที, วันละ 1 งาน)
-- -----------------------------------------------------------------------------
create or replace function accept_job(p_job_id uuid) returns jobs
language plpgsql security definer set search_path = public as $$
declare
  v_vip boolean;
  v_job jobs;
begin
  select vip_status into v_vip from mechanic_profiles
  where user_id = auth.uid() and verification_status = 'verified';
  if not found then
    raise exception 'บัญชีช่างยังไม่ผ่านการตรวจสอบจากแอดมิน';
  end if;

  update jobs set mechanic_id = auth.uid(), status = 'matched', accepted_at = now()
  where id = p_job_id and status = 'open' and mechanic_id is null
    and now() >= case when v_vip then visible_to_vip_at else visible_to_all_at end
  returning * into v_job;

  if v_job.id is null then
    raise exception 'งานนี้มีช่างรับไปแล้ว หรือยังไม่ถึงเวลาที่คุณเห็นงาน';
  end if;
  return v_job;
exception when unique_violation then
  raise exception 'คุณมีงานในวันนี้แล้ว รับได้วันละ 1 งาน';
end $$;
grant execute on function accept_job(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- ข้อมูลตั้งต้น
-- -----------------------------------------------------------------------------
insert into service_types (code, name, base_price, extra_per_wa, sort_order) values
  ('mow_only_no_haul',  'ตัดหญ้าอย่างเดียว ไม่ขนทิ้ง',  800, 2, 1),
  ('mow_only_haul',     'ตัดหญ้าอย่างเดียว ขนทิ้ง',    1000, 3, 2),
  ('mow_trim_no_haul',  'ตัดหญ้าและแต่งกิ่ง ไม่ขนทิ้ง', 1000, 3, 3),
  ('mow_trim_haul',     'ตัดหญ้าและแต่งกิ่ง ขนทิ้ง',   1200, 4, 4),
  ('trim_only_no_haul', 'แต่งกิ่งอย่างเดียว ไม่ขนทิ้ง', 1000, 3, 5),
  ('trim_only_haul',    'แต่งกิ่งอย่างเดียว ขนทิ้ง',   1200, 4, 6);

insert into grass_height_levels (level, label, multiplier) values
  (0, 'น้อยกว่า 6"',  1.0),
  (1, 'มากกว่า 6"',  1.5),
  (2, 'มากกว่า 12"', 2.0);

insert into monthly_packages (code, name, visits_per_month, pricing_service_code, discount_percent, fixed_monthly_price, sort_order) values
  ('monthly_1',         '1 ครั้งต่อเดือน',            1,    'mow_trim_haul', 10, null,  1),
  ('monthly_2',         '2 ครั้งต่อเดือน',            2,    'mow_trim_haul', 15, null,  2),
  ('monthly_3',         '3 ครั้งต่อเดือน',            3,    'mow_trim_haul', 20, null,  3),
  ('monthly_no_sunday', 'รายเดือน (หยุดวันอาทิตย์)', null, null,             0,  14100, 4);

insert into platform_settings (key, value) values
  ('platform_fee_percent',          '15'),
  ('debris_rate_per_hour',          '200'),
  ('prepaid_month_options',         '[3, 6, 12]'),
  ('customer_cancel_days_before',   '2'),
  ('mechanic_cancel_days_before',   '2'),
  ('escrow_release_days',           '2'),
  ('max_jobs_per_mechanic_per_day', '1'),
  ('vip_head_start_seconds',        '30'),
  ('max_lawn_photos',               '10'),
  ('otp_cooldown_seconds',          '60'),
  ('otp_valid_minutes',             '5'),
  ('adjustment_expiry_minutes',     '60');
