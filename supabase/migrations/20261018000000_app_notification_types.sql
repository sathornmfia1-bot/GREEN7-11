-- ประเภทแจ้งเตือนเพิ่มเติมที่หน้าเว็บใช้
--   booking_paid     : ลูกค้าชำระเงินสำเร็จ งานเข้า Job Pool
--   review_received  : ช่างได้รับรีวิวจากลูกค้า (โอนเงินออกจาก Escrow ได้แล้ว)
alter type notification_type add value if not exists 'booking_paid';
alter type notification_type add value if not exists 'review_received';
