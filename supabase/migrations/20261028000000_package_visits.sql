-- ตารางนัดของแพ็กเกจรายเดือน (รันหลัง 20261027000000_care_packages.sql)
-- ลูกค้าเลือกวันนัดแรก ระบบสร้างนัดทั้งหมดตามจำนวนครั้งต่อเดือน × จำนวนเดือนที่จ่ายล่วงหน้า
-- แต่ละนัดเป็นงาน 1 งาน (สร้างเข้า Job Pool ล่วงหน้า 7 วันก่อนนัด) และเงินแบ่งเป็นรายนัด (amount)
create table if not exists booking_visits (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings (id) on delete cascade,
  visit_no        smallint not null,
  cycle_no        smallint not null,
  cycle_start     date not null,
  cycle_end       date not null,
  scheduled_date  date not null,
  amount          numeric(12,2) not null,
  -- scheduled = รอสร้างงาน · released = สร้างงานแล้ว (job_id) · cancelled = ยกเลิก
  status          varchar(20) not null default 'scheduled' check (status in ('scheduled', 'released', 'cancelled')),
  job_id          uuid references jobs (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint booking_visits_date_in_cycle check (scheduled_date between cycle_start and cycle_end)
);
create unique index if not exists booking_visits_unique on booking_visits (booking_id, visit_no);
create index if not exists booking_visits_release_idx on booking_visits (scheduled_date) where status = 'scheduled';
drop trigger if exists booking_visits_updated_at on booking_visits;
create trigger booking_visits_updated_at before update on booking_visits for each row execute function set_updated_at();

alter table booking_visits enable row level security;
drop policy if exists "customer reads own visits" on booking_visits;
create policy "customer reads own visits" on booking_visits for select
  using (exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid()) or is_admin());

-- งานของนัดถัดไปเสนอให้ช่างคนเดิมก่อน (ช่างประจำ) จนถึง offer_expires_at แล้วจึงเปิดให้ช่างทุกคน
alter table jobs
  add column if not exists offered_to       uuid references users (id),
  add column if not exists offer_expires_at timestamptz;

-- แจ้งเตือนใหม่: visit_offered = เสนองานนัดถัดไปให้ช่างประจำ · visit_rescheduled = ลูกค้าเลื่อนนัด
alter type notification_type add value if not exists 'visit_offered';
alter type notification_type add value if not exists 'visit_rescheduled';
