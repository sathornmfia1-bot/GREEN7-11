import Image from 'next/image';

// ภาพหน้าแรก: สวนสนามหญ้ากับต้นไม้ตัดแต่งทรง (CC0 จาก rawpixel.com/image/6054144) ปรับโทนเขียวแบรนด์
// แล้วไล่สีให้กลืนกับพื้นขาวด้านบนและแถบเขียวด้านล่าง
export function HeroScene() {
  return (
    <div className="relative h-64 w-full overflow-hidden sm:h-72 md:h-80 lg:h-[26rem]">
      <Image src="/hero-lawn.jpg" alt="สวนสนามหญ้าสีเขียวกับต้นไม้และพุ่มไม้ที่ตัดแต่งทรงสวยงาม" fill priority sizes="100vw" className="object-cover object-[50%_70%] saturate-[.95] brightness-[1.05]" />
      <div className="absolute inset-0 bg-brand-400/30 mix-blend-soft-light" />
      <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white via-white/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-brand-500 via-brand-500/40 to-transparent" />
    </div>
  );
}
