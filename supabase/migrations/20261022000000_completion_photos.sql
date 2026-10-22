-- รูปงานที่เสร็จแล้ว: ช่างแนบอย่างน้อย 5 รูปตอนกด "ทำงานเสร็จแล้ว" · ลูกค้าเห็นประกอบการรีวิว
-- เก็บรูปเป็น data URL (JPEG ที่ย่อแล้ว) เหมือน booking_photos
-- เปิด RLS โดยไม่มี policy → อ่าน/เขียนผ่านฝั่งเซิร์ฟเวอร์ (service role) ที่ตรวจสิทธิ์แล้วเท่านั้น
create table if not exists job_completion_photos (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs (id) on delete cascade,
  mechanic_id uuid not null references users (id),
  url         text not null,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists job_completion_photos_job on job_completion_photos (job_id, sort_order);

alter table job_completion_photos enable row level security;
