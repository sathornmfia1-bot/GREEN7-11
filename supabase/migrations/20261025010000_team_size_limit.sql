-- จำนวนสมาชิกช่างตัดหญ้าได้สูงสุด 5 คน (เดิมอนุญาต 1–999)
-- กำลังรับงาน: คนละไม่เกิน 400 ตร.ว. — ตรวจตอนกดรับงานฝั่งเซิร์ฟเวอร์ (app/_lib/rules.ts: maxJobArea)
-- ทีมที่เคยกรอกเกิน 5 คน ปรับเป็น 5 ก่อนเปลี่ยนเงื่อนไข
update mechanic_profiles set team_size = 5 where team_size > 5;
alter table mechanic_profiles drop constraint if exists mechanic_profiles_team_size_check;
alter table mechanic_profiles add constraint mechanic_profiles_team_size_check check (team_size between 1 and 5);
