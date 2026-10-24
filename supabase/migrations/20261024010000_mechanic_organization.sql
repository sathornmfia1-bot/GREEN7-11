-- ข้อมูลองค์กรของช่างตัดหญ้า (กรอกตอนสมัคร)
--   organization_name : ชื่อองค์กร/ทีม/บริษัท (ไม่บังคับ)
--   team_size         : จำนวนสมาชิกช่างตัดหญ้า (รวมตัวผู้สมัคร · อย่างน้อย 1 คน)
alter table mechanic_profiles
  add column if not exists organization_name varchar(150),
  add column if not exists team_size smallint not null default 1 check (team_size between 1 and 999);
