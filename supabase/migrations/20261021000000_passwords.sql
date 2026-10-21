-- รหัสผ่านสำหรับเข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่าน
--   user_credentials : เก็บเฉพาะค่า hash (scrypt) ของรหัสผ่าน · ไม่เก็บรหัสผ่านจริง
--                      นับครั้งที่ใส่ผิด และล็อกบัญชีชั่วคราวเมื่อผิดหลายครั้ง
--   password_resets  : รหัสยืนยัน 6 หลักสำหรับ "ลืม/ยังไม่เคยตั้งรหัสผ่าน" (เก็บเป็น hash · หมดอายุใน 5 นาที)
-- เปิด RLS โดยไม่มี policy → หน้าเว็บอ่าน/เขียนตรงไม่ได้ ใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์ (service role)
create table if not exists user_credentials (
  user_id          uuid primary key references users (id) on delete cascade,
  password_hash    text        not null,
  failed_attempts  integer     not null default 0,
  locked_until     timestamptz,
  updated_at       timestamptz not null default now()
);

create table if not exists password_resets (
  user_id     uuid primary key references users (id) on delete cascade,
  code_hash   text        not null,
  expires_at  timestamptz not null,
  attempts    integer     not null default 0,
  created_at  timestamptz not null default now()
);

alter table user_credentials enable row level security;
alter table password_resets  enable row level security;
