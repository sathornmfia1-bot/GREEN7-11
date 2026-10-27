import { getSupabase, isSupabaseConfigured } from './supabase';
import { grassHeightMultipliers, monthlyPackages, platformFeePercent, pricingOptions } from '../_components/pricing';

export type HealthCheck = { label: string; ok: boolean; detail: string };
export type HealthReport =
  | { status: 'not_configured' }
  | { status: 'error'; message: string }
  | { status: 'connected'; checks: HealthCheck[] };

// ตรวจการเชื่อมต่อ และเทียบตารางราคาในฐานข้อมูลกับค่าที่หน้าเว็บใช้อยู่
export async function checkSupabase(): Promise<HealthReport> {
  if (!isSupabaseConfigured()) return { status: 'not_configured' };
  const supabase = getSupabase()!;

  const [services, levels, packages, settings] = await Promise.all([
    supabase.from('service_types').select('name, base_price, extra_per_wa').order('sort_order'),
    supabase.from('grass_height_levels').select('level, multiplier').order('level'),
    supabase.from('monthly_packages').select('code, base_price, extra_per_wa').eq('is_active', true).order('sort_order'),
    supabase.from('platform_settings').select('key, value'),
  ]);
  const failed = [services, levels, packages, settings].find((result) => result.error);
  if (failed?.error) {
    const missingTable = ['42P01', 'PGRST205'].includes(failed.error.code) || /does not exist|Could not find the table/.test(failed.error.message);
    const hint = missingTable
      ? ' — ยังไม่ได้รัน supabase/migrations/20261017000000_init.sql'
      : '';
    return { status: 'error', message: `${failed.error.message}${hint}` };
  }

  const serviceRows = services.data ?? [];
  const servicesMatch = pricingOptions.every((option) => serviceRows.some((row) =>
    row.name === option.name && Number(row.base_price) === option.basePrice && Number(row.extra_per_wa) === option.extraPerWa));
  const levelRows = levels.data ?? [];
  const levelsMatch = grassHeightMultipliers.every((multiplier, level) => levelRows.some((row) => row.level === level && Number(row.multiplier) === multiplier));
  const packageRows = packages.data ?? [];
  const packagesMatch = monthlyPackages.every((pack) => packageRows.some((row) =>
    row.code === pack.code && Number(row.base_price) === pack.basePrice && Number(row.extra_per_wa) === pack.extraPerWa));
  const feeRow = (settings.data ?? []).find((row) => row.key === 'platform_fee_percent');

  return {
    status: 'connected',
    checks: [
      { label: 'ประเภทบริการ', ok: servicesMatch, detail: `${serviceRows.length} รายการในฐานข้อมูล${servicesMatch ? ' · ราคาตรงกับหน้าเว็บ' : ' · ราคาไม่ตรงกับหน้าเว็บ'}` },
      { label: 'ตัวคูณความสูงหญ้า', ok: levelsMatch, detail: `${levelRows.length} ระดับ${levelsMatch ? ' · ตรงกัน' : ' · ไม่ตรงกัน'}` },
      { label: 'แพ็กเกจรายเดือน', ok: packagesMatch, detail: `${packageRows.length} แพ็กเกจ${packagesMatch ? ' · ตรงกัน' : ' · ไม่ตรงกัน'}` },
      { label: 'ค่า Platform', ok: Number(feeRow?.value) === platformFeePercent, detail: feeRow ? `${feeRow.value}% ในฐานข้อมูล` : 'ไม่พบค่า platform_fee_percent' },
    ],
  };
}
