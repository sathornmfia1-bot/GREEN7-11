// ย่อรูปเป็น JPEG ขนาดเล็ก (data URL) เพื่อเก็บในฐานข้อมูลจำลองและแสดงข้ามแท็บได้
export function resizeImage(file: File, maxSize = 480, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('อ่านไฟล์รูปไม่ได้'));
    };
    image.src = url;
  });
}
