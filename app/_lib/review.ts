// หัวข้อรีวิวที่ลูกค้าประเมินช่าง — ย่อให้กดได้ภายในไม่กี่วินาที
// ขั้นที่ 1 เลือกสถานะงาน · ขั้นที่ 2 ให้ดาว 3 หัวข้อ (ข้ามได้ถ้าช่างไม่มา) · ขั้นที่ 3 ติ๊กปัญหา/เขียนเพิ่ม (ไม่บังคับ)

export type ReviewStatus = 'complete' | 'partial' | 'no_show';
export type ReviewTopic = 'cleanliness' | 'punctuality' | 'service';

export const reviewStatuses: { value: ReviewStatus; icon: string; label: string; hint: string }[] = [
  { value: 'complete', icon: '✅', label: 'เสร็จเรียบร้อยดี', hint: 'ทำครบทุกพื้นที่ เก็บงานเรียบร้อย' },
  { value: 'partial', icon: '⚠️', label: 'เสร็จบางส่วน', hint: 'เช่น ลืมตัดหลังบ้าน ลืมเก็บกวาด' },
  { value: 'no_show', icon: '❌', label: 'ช่างไม่มาตามนัด', hint: 'ไม่มาและไม่แจ้งล่วงหน้า' },
];

export const reviewTopics: { key: ReviewTopic; icon: string; label: string; hint: string }[] = [
  { key: 'cleanliness', icon: '🧹', label: 'ความสะอาดและการเก็บงาน', hint: 'เก็บกวาดเศษหญ้าจากพื้นปูน/ลานจอดรถ · แพ็กขยะใส่ถุง · เล็มขอบซอกกำแพงและโคนต้นไม้เนียน' },
  { key: 'punctuality', icon: '⏰', label: 'ตรงเวลาและน่าเชื่อถือ', hint: 'มาตามวันเวลานัด · แจ้งล่วงหน้าถ้าต้องเลื่อน · ทำครบเต็มพื้นที่ ไม่ทิ้งงาน' },
  { key: 'service', icon: '🙏', label: 'มารยาทและความระมัดระวัง', hint: 'พูดจาสุภาพ · ไม่เสียงดัง/จอดรถขวางเพื่อนบ้าน · ไม่ทำต้นไม้ โคมไฟ หรือสายไฟเสียหาย' },
];

// ปัญหาที่พบบ่อย ให้ลูกค้าติ๊กแทนการพิมพ์
export const reviewIssues = ['ตัดไม่ครบทุกพื้นที่', 'ไม่เก็บกวาดเศษหญ้า', 'ไม่แพ็ก/ไม่ทิ้งขยะ', 'เล็มขอบไม่เรียบร้อย', 'มาสาย/ไม่แจ้งล่วงหน้า', 'ไม่สุภาพ/เสียงดัง', 'ของในสวนเสียหาย'] as const;

export const reviewTopicStars = [1, 2, 3, 4, 5] as const;
export const starWords: Record<number, string> = { 1: 'ต้องปรับปรุง', 2: 'พอใช้', 3: 'ดี', 4: 'ดีมาก', 5: 'ประทับใจ' };

export type ReviewInput = {
  status: ReviewStatus;
  topics: Partial<Record<ReviewTopic, number>>;
  issues: string[];
  comment: string;
};

// คะแนนรวม (ใช้คิดเรทติ้งเฉลี่ยของช่าง): เฉลี่ย 3 หัวข้อ · เสร็จบางส่วนได้ไม่เกิน 3 ดาว · ไม่มาตามนัดได้ 1 ดาว
export function overallRating(input: Pick<ReviewInput, 'status' | 'topics'>): number {
  if (input.status === 'no_show') return 1;
  const scores = reviewTopics.map((topic) => input.topics[topic.key] ?? 0);
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  return input.status === 'partial' ? Math.min(average, 3) : average;
}

// ตรวจข้อมูลรีวิว · คืนข้อความผิดพลาด หรือ null ถ้าครบ
export function reviewProblem(input: ReviewInput): string | null {
  if (!reviewStatuses.some((status) => status.value === input.status)) return 'กรุณาเลือกสถานะงาน';
  if (input.status !== 'no_show' && reviewTopics.some((topic) => !reviewTopicStars.includes(input.topics[topic.key] as 1))) return 'กรุณาให้ดาวครบทั้ง 3 หัวข้อ';
  if (input.status === 'partial' && !input.issues.length && !input.comment.trim()) return 'กรุณาเลือกสิ่งที่ยังไม่เรียบร้อย หรือเขียนอธิบายสั้นๆ';
  return null;
}
