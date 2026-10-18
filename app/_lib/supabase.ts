import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

// คืน null เมื่อยังไม่ได้ตั้งค่า .env.local — หน้าเว็บจะใช้ข้อมูลตัวอย่างในโค้ดต่อไปได้
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  client ??= createClient(url, anonKey);
  return client;
}
