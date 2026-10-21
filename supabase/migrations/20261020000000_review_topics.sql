-- รีวิวแบบแยกหัวข้อ: สถานะงาน + ดาว 3 หัวข้อ + ปัญหาที่พบ
--   status              : complete (เสร็จเรียบร้อย) · partial (เสร็จบางส่วน) · no_show (ช่างไม่มาตามนัด)
--   cleanliness_rating  : ความสะอาดและการเก็บงาน
--   punctuality_rating  : ตรงเวลาและน่าเชื่อถือ
--   service_rating      : มารยาทและความระมัดระวัง
--   issues              : ปัญหาที่ลูกค้าติ๊ก (เช่น ไม่เก็บกวาดเศษหญ้า)
-- rating เดิมยังเป็นคะแนนรวมที่ใช้คิดเรทติ้งเฉลี่ยของช่าง (คำนวณฝั่งเซิร์ฟเวอร์)
alter table reviews
  add column if not exists status             text not null default 'complete' check (status in ('complete', 'partial', 'no_show')),
  add column if not exists cleanliness_rating smallint check (cleanliness_rating between 1 and 5),
  add column if not exists punctuality_rating smallint check (punctuality_rating between 1 and 5),
  add column if not exists service_rating     smallint check (service_rating between 1 and 5),
  add column if not exists issues             text[] not null default '{}';
