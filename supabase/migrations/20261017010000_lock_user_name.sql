-- ชื่อ-นามสกุลใช้ตามที่ลงทะเบียน (และเป็นชื่อบัญชีรับเงินคืน) ผู้ใช้แก้ไขเองไม่ได้ — แก้ได้เฉพาะแอดมิน
create or replace function prevent_user_name_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name)
     and not is_admin() then
    raise exception 'ชื่อ-นามสกุลแก้ไขไม่ได้ กรุณาติดต่อแอดมิน';
  end if;
  return new;
end $$;

create trigger users_lock_name before update of first_name, last_name on users
  for each row execute function prevent_user_name_change();
