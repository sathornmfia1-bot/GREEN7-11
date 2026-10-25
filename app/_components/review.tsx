'use client';

import { useState } from 'react';
import type { Review } from '../_lib/types';
import { overallRating, reviewIssues, reviewProblem, reviewStatuses, reviewTopicStars, reviewTopics, starWords, type ReviewInput, type ReviewStatus, type ReviewTopic } from '../_lib/review';

// ฟอร์มรีวิวช่าง 3 ขั้น: สถานะงาน → ดาว 3 หัวข้อ → ปัญหาที่พบ/ความเห็น (ไม่บังคับ)
export function ReviewForm({ onSubmit, onCancel }: { onSubmit: (input: ReviewInput) => Promise<boolean>; onCancel: () => void }) {
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [topics, setTopics] = useState<Partial<Record<ReviewTopic, number>>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  // มือถือ: ช่องความเห็นยุบไว้หลังปุ่ม "+ เขียนความเห็น" (คอมแสดงตลอด)
  const [showComment, setShowComment] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const input: ReviewInput | null = status ? { status, topics, issues, comment } : null;
  const total = input && (status === 'no_show' || reviewTopics.every((topic) => topics[topic.key])) ? overallRating(input) : null;

  async function send() {
    const problem = input ? reviewProblem(input) : 'กรุณาเลือกสถานะงาน';
    if (problem || !input) {
      setError(problem ?? '');
      return;
    }
    setSending(true);
    const sent = await onSubmit(input);
    setSending(false);
    if (!sent) setError('ส่งรีวิวไม่สำเร็จ ลองอีกครั้ง');
  }

  function toggleIssue(issue: string) {
    setIssues((current) => (current.includes(issue) ? current.filter((item) => item !== issue) : [...current, issue]));
    setError('');
  }

  return (
    <div>
      <p className="font-semibold text-slate-800">1. งานเป็นอย่างไรบ้าง?</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="สถานะงาน">
        {reviewStatuses.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={status === item.value}
            onClick={() => { setStatus(item.value); setError(''); }}
            className={`rounded-xl border px-3 py-2 text-left max-sm:flex max-sm:min-h-[76px] max-sm:flex-col max-sm:items-center max-sm:justify-center max-sm:px-1 max-sm:text-center ${status === item.value ? 'border-brand-500 bg-white ring-2 ring-brand-500/30' : 'border-slate-200 bg-white/70 hover:border-slate-300'}`}
          >
            <span className="block font-semibold text-slate-900 max-sm:text-sm max-sm:leading-snug"><span className="max-sm:mb-1 max-sm:block max-sm:text-xl">{item.icon}</span> {item.label}</span>
            <span className="block text-xs text-slate-500 max-sm:hidden">{item.hint}</span>
          </button>
        ))}
      </div>

      {status && status !== 'no_show' && (
        <>
          <p className="mt-4 font-semibold text-slate-800">2. ให้ดาวแต่ละเรื่อง</p>
          <div className="mt-2 space-y-3">
            {reviewTopics.map((topic) => (
              <div key={topic.key} className="rounded-xl bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{topic.icon} {topic.label}</span>
                  <span className="flex items-center gap-1">
                    <span className="flex" role="radiogroup" aria-label={topic.label}>
                      {reviewTopicStars.map((star) => (
                        <button
                          key={star}
                          type="button"
                          role="radio"
                          aria-checked={topics[topic.key] === star}
                          aria-label={`${star} ดาว`}
                          onClick={() => { setTopics((current) => ({ ...current, [topic.key]: star })); setError(''); }}
                          className={`px-0.5 text-2xl leading-none max-sm:px-1 max-sm:text-[2rem] ${star <= (topics[topic.key] ?? 0) ? 'text-amber-500' : 'text-slate-300'}`}
                        >★</button>
                      ))}
                    </span>
                    <span className="w-20 text-right text-xs text-slate-500 max-sm:hidden">{topics[topic.key] ? starWords[topics[topic.key]!] : ''}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 max-sm:hidden">{topic.hint}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {status && (
        <>
          <p className="mt-4 font-semibold text-slate-800">{status === 'no_show' ? '2' : '3'}. {status === 'partial' ? 'อะไรที่ยังไม่เรียบร้อย?' : 'มีอะไรอยากบอกเพิ่มไหม? (ไม่บังคับ)'}</p>
          {status !== 'no_show' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {reviewIssues.map((issue) => (
                <button key={issue} type="button" aria-pressed={issues.includes(issue)} onClick={() => toggleIssue(issue)} className={`rounded-full border px-3 py-1 text-xs font-medium max-sm:min-h-[40px] max-sm:px-3.5 max-sm:text-sm ${issues.includes(issue) ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                  {issue}
                </button>
              ))}
            </div>
          )}
          {!showComment && status !== 'no_show' && <button type="button" onClick={() => setShowComment(true)} className="mt-2 min-h-[48px] font-semibold text-brand-700 sm:hidden">+ เขียนความเห็น</button>}
          <textarea value={comment} onChange={(event) => { setComment(event.target.value); setError(''); }} rows={2} maxLength={500} placeholder={status === 'no_show' ? 'เล่าเหตุการณ์สั้นๆ เช่น รอถึงกี่โมง ติดต่อช่างได้ไหม' : 'เล่าประสบการณ์ หรือคำชมถึงช่าง'} className={`mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none ${showComment || status === 'no_show' ? '' : 'max-sm:hidden'}`} />
        </>
      )}

      {total !== null && <p className="mt-2 text-xs text-slate-600">คะแนนรวม <span className="text-amber-500">{'★'.repeat(total)}</span>{'☆'.repeat(5 - total)} · {starWords[total]}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={send} disabled={sending} className="rounded-full bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{sending ? 'กำลังส่ง…' : 'ส่งรีวิว'}</button>
        <button type="button" onClick={onCancel} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700">ไว้ทีหลัง</button>
      </div>
    </div>
  );
}

// สรุปรีวิวที่ส่งแล้ว (ลูกค้าและช่างเห็นเหมือนกัน)
export function ReviewSummary({ review, title }: { review: Review; title: string }) {
  const status = reviewStatuses.find((item) => item.value === review.status) ?? reviewStatuses[0];
  return (
    <div className="text-sm text-slate-700">
      <p>
        {title} <span className="text-amber-500">{'★'.repeat(review.rating)}</span> · <span className="font-medium">{status.icon} {status.label}</span>
      </p>
      {review.status !== 'no_show' && reviewTopics.some((topic) => review.topics[topic.key]) && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
          {reviewTopics.map((topic) => review.topics[topic.key] && <li key={topic.key}>{topic.icon} {topic.label} {review.topics[topic.key]}/5</li>)}
        </ul>
      )}
      {review.issues.length > 0 && <p className="mt-1 text-xs text-rose-700">ยังไม่เรียบร้อย: {review.issues.join(' · ')}</p>}
      {review.comment && <p className="mt-1 text-slate-600">“{review.comment}”</p>}
    </div>
  );
}
