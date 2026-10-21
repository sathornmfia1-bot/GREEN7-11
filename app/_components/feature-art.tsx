import Image from 'next/image';

// ภาพหัวการ์ดจุดเด่น: รูปถ่ายใน public/features + โทนสีเขียวแบรนด์ทับเล็กน้อยให้ทุกใบเข้าชุดกัน
// รูป happy-lawn / verified-mechanic / garden-tools เป็น CC0 จาก rawpixel.com (ผ่าน Openverse)
type Variant = 'phone' | 'grass' | 'mower' | 'crew';

const photos: Record<Variant, { src: string; position: string }> = {
  phone: { src: '/features/app-phone.jpg', position: 'object-[42%_42%]' },
  grass: { src: '/features/happy-lawn.jpg', position: 'object-[50%_70%]' },
  mower: { src: '/features/verified-mechanic.jpg', position: 'object-[40%_60%]' },
  crew: { src: '/features/garden-tools.jpg', position: 'object-[50%_55%]' },
};

export function FeatureArt({ variant }: { variant: Variant }) {
  const photo = photos[variant];
  return (
    <div className="relative h-36 w-full overflow-hidden" aria-hidden="true">
      <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw" className={`object-cover brightness-[1.08] saturate-[.9] ${photo.position}`} />
      <div className="absolute inset-0 bg-brand-400/35 mix-blend-soft-light" />
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-800/30 via-transparent to-accent-300/20" />
    </div>
  );
}
