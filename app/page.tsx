'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AddressEditor, AddressMap, distanceKm, emptyAddressDetails, formatAddress, formatDistance, mapQuery, type AddressDetails } from './_components/address';
import { loadWorkerProfile, type WorkerStatus } from './_components/worker-profile';
import { loadCustomerProfile } from './_components/customer-profile';
import { thaiBanks } from './_components/form-ui';
import { DateInput, daysFromToday, formatRelativeThaiDate, isoDateBefore, formatThaiDate, isoDateFromToday, todayIsoDate } from './_components/date-input';
import { sampleJobs, type AppNotification, type Job, type QuoteAdjustment, type Review, type WorkStage } from './_components/jobs';
import { AdjustmentDecision, InspectionPanel } from './_components/inspection';
import { currentWorkerId, workerRating } from './_components/earnings';
import { WorkerCard } from './_components/worker-card';
import { baseAreaWa, grassHeightLabels, monthlyDiscounts, monthlyPackagePrice, monthlyPackageService, netPayout, platformFeePercent, pricePerVisit, pricingOptions } from './_components/pricing';

type ServiceAddress = { id: number; label: string; details: AddressDetails; isDefault: boolean };

const customerSteps = ['รอช่างรับ', 'จับคู่ช่างแล้ว', 'กำลังทำงาน', 'รอตรวจรับ', 'เสร็จสมบูรณ์'];


const initialNotifications: AppNotification[] = [
  { id: 1, kind: 'info', message: 'มีคำขอปรับราคาหน้างาน รอการยืนยัน', createdAt: '', read: false },
  { id: 2, kind: 'info', message: 'ระบบคืนเงินสำหรับรอบที่ยังไม่เริ่มแล้ว', createdAt: '', read: false },
];

// ปุ่มอัปเดตสถานะของช่าง และข้อความแจ้งเตือนที่ส่งถึงลูกค้า
const workStageActions: Record<Exclude<WorkStage, 'done'>, { next: WorkStage; label: string; kind: AppNotification['kind']; message: string }> = {
  matched: { next: 'arrived', label: '📍 ถึงที่นัดหมายแล้ว', kind: 'arrived', message: 'ช่างถึงที่นัดหมายแล้ว' },
  arrived: { next: 'working', label: '▶️ เริ่มทำงาน', kind: 'started', message: 'ช่างเริ่มทำงานแล้ว' },
  working: { next: 'done', label: '✅ ทำงานเสร็จแล้ว', kind: 'completed', message: 'ช่างทำงานเสร็จแล้ว และขอให้คุณช่วยรีวิว' },
};

const workStageLabels: Record<WorkStage, string> = { matched: 'จับคู่ช่างแล้ว', arrived: 'ถึงที่นัดหมายแล้ว', working: 'กำลังทำงาน', done: 'ทำงานเสร็จแล้ว' };

const notificationStyles: Record<AppNotification['kind'], string> = {
  arrived: 'bg-sky-50',
  started: 'bg-emerald-50',
  completed: 'bg-amber-50',
  info: 'bg-slate-50',
};

function formatTime(iso: string) {
  return iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
}

// Escrow: ช่างโอนเงินออกได้เมื่อลูกค้ารีวิวแล้ว หรือครบ 2 วันหลังกดทำงานเสร็จ
const escrowReleaseDays = 2;

function payoutAvailableAt(job: Job) {
  return job.completedAt ? new Date(job.completedAt).getTime() + escrowReleaseDays * 86400000 : Infinity;
}

function canReleasePayout(job: Job, reviewed: boolean) {
  if (job.workStage !== 'done' || job.payoutReleasedAt) return false;
  return reviewed || Date.now() >= payoutAvailableAt(job);
}

function formatLocalDateTime(time: number | string) {
  const at = new Date(time);
  const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return `${formatThaiDate(iso)} ${at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
}

const maxLawnPhotos = 10;

// คำขอปรับราคาหมดอายุ ถ้าลูกค้าไม่ตอบภายใน 1 ชั่วโมง (PRD 5.3)
const adjustmentExpiryMinutes = 60;

// 0812345678 → 081-234-5678
function formatPhone(digits: string) {
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

// ลูกค้ายกเลิกการจ้างงานได้ก่อนวันนัดหมายอย่างน้อย 2 วัน
const customerCancelDaysBefore = 2;

// ช่างยกเลิกงานได้ก่อนวันนัดหมายอย่างน้อย 2 วัน
const workerCancelDaysBefore = 2;

function canWorkerCancel(job: Job) {
  return daysFromToday(job.date) >= workerCancelDaysBefore;
}

function cancelDeadline(job: Job) {
  return isoDateBefore(job.date, workerCancelDaysBefore);
}

function jobWhen(job: Job) {
  return [formatRelativeThaiDate(job.date), job.time].filter(Boolean).join(' ');
}

const buttonClass = 'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export default function Home() {
  const [paymentMode, setPaymentMode] = useState<'single' | 'monthly'>('single');
  const [service, setService] = useState(pricingOptions[0].name);
  const [area, setArea] = useState('120');
  const [grassHeight, setGrassHeight] = useState(0);
  const [appointment, setAppointment] = useState('');
  const [monthlyFrequency, setMonthlyFrequency] = useState(2);
  const [sundayPackage, setSundayPackage] = useState(false);
  const [prepaidMonths, setPrepaidMonths] = useState(3);
  const [lawnPhotos, setLawnPhotos] = useState<{ name: string; url: string }[]>([]);

  function addLawnPhotos(files: FileList | null) {
    if (!files) return;
    const images = [...files].filter((file) => file.type.startsWith('image/'));
    const room = maxLawnPhotos - lawnPhotos.length;
    if (images.length > room) setNotice(`แนบรูปได้สูงสุด ${maxLawnPhotos} รูป · เพิ่มได้อีก ${room} รูป`);
    setLawnPhotos((current) => [...current, ...images.slice(0, room).map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))]);
  }

  function removeLawnPhoto(url: string) {
    // รูปของงานที่ชำระแล้วยังถูกใช้ใน Job Pool จึงไม่คืนหน่วยความจำ
    if (!paid) URL.revokeObjectURL(url);
    setLawnPhotos((current) => current.filter((photo) => photo.url !== url));
  }
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  const [booking, setBooking] = useState<{ jobId: number | null; amount: number; date: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundBank, setRefundBank] = useState('');
  const [refundAccount, setRefundAccount] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [notice, setNotice] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewingJobId, setReviewingJobId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  // แจ้งเตือนแยกผู้รับ: ลูกค้า (กระดิ่งด้านบน) และช่าง (ในส่วน Job Pool)
  const customerNotifications = notifications.filter((item) => (item.audience ?? 'customer') === 'customer');
  const workerNotifications = notifications.filter((item) => item.audience === 'worker');
  const unreadCount = customerNotifications.filter((item) => !item.read).length;
  const workerUnreadCount = workerNotifications.filter((item) => !item.read).length;
  const [workerNotificationsOpen, setWorkerNotificationsOpen] = useState(false);

  function notifyWorker(jobId: number, message: string) {
    setNotifications((current) => [{ id: Date.now() + Math.random(), jobId, audience: 'worker', kind: 'info', message, createdAt: new Date().toISOString(), read: false }, ...current]);
  }

  function toggleWorkerNotifications() {
    setWorkerNotificationsOpen(!workerNotificationsOpen);
    if (!workerNotificationsOpen) setNotifications((current) => current.map((item) => item.audience === 'worker' ? { ...item, read: true } : item));
  }
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [firstName, setFirstName] = useState('สมชาย');
  const [lastName, setLastName] = useState('ใจดี');
  const [phone, setPhone] = useState('081-234-5678');
  const [serviceAddresses, setServiceAddresses] = useState<ServiceAddress[]>([
    { id: 1, label: 'บ้าน', details: { ...emptyAddressDetails, addressLine: '1', province: 'กรุงเทพมหานคร', amphoe: 'คลองสาน', district: 'คลองต้นไทร' }, isDefault: true },
  ]);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('บ้าน');
  const [newAddressDetails, setNewAddressDetails] = useState<AddressDetails>(emptyAddressDetails);
  const [newAddressDefault, setNewAddressDefault] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [editAddressLabel, setEditAddressLabel] = useState('');
  const [editAddressDetails, setEditAddressDetails] = useState<AddressDetails>(emptyAddressDetails);
  const [confirmDeleteAddressId, setConfirmDeleteAddressId] = useState<number | null>(null);
  const [quoteAddressId, setQuoteAddressId] = useState<number | null>(null);
  const [choosingQuoteAddress, setChoosingQuoteAddress] = useState(false);
  const [jobs, setJobs] = useState(sampleJobs);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [workerBase, setWorkerBase] = useState<AddressDetails | null>({
    addressLine: '12 ถนนงามวงศ์วาน', province: 'นนทบุรี', amphoe: 'เมืองนนทบุรี', district: 'บางกระสอ', location: { lat: 13.8577, lng: 100.5236 },
  });
  const [workerBaseDraft, setWorkerBaseDraft] = useState<AddressDetails>(emptyAddressDetails);
  const [editingWorkerBase, setEditingWorkerBase] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [workerRejectReason, setWorkerRejectReason] = useState('');
  const [workerBankLabel, setWorkerBankLabel] = useState('บัญชีธนาคารของคุณ');
  // ข้อมูลช่างที่ลูกค้าเห็นเมื่อช่างรับงาน (บัญชีตัวอย่าง ถ้ายังไม่ได้สมัครช่างในเบราว์เซอร์นี้)
  const [workerName, setWorkerName] = useState('สมศักดิ์ ตัดเก่ง');
  const [workerPhoto, setWorkerPhoto] = useState<string | undefined>(undefined);
  // PRD 4.2.1: ช่างที่ยังไม่ผ่านการตรวจสอบรับงานไม่ได้ (ไม่มีใบสมัครในเบราว์เซอร์นี้ = บัญชีตัวอย่างที่อนุมัติแล้ว)
  const workerCanAcceptJobs = workerStatus === null || workerStatus === 'verified';

  useEffect(() => {
    const profile = loadWorkerProfile();
    if (!profile) return;
    setWorkerBase(profile.baseAddress);
    setWorkerStatus(profile.status);
    setWorkerRejectReason(profile.rejectReason ?? '');
    setWorkerBankLabel(`${profile.bankName} xxx-${profile.accountNumber.slice(-4)}`);
    setWorkerName(`${profile.firstName} ${profile.lastName}`);
    setWorkerPhoto(profile.photoDataUrl);
  }, []);

  const [customerRegistered, setCustomerRegistered] = useState(false);

  useEffect(() => {
    const profile = loadCustomerProfile();
    if (!profile) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPhone(profile.phone);
    setServiceAddresses([{ id: 1, label: profile.addressLabel, details: profile.address, isDefault: true }]);
    setCustomerRegistered(true);
  }, []);
  const [jobStep, setJobStep] = useState(0);
  const [adjustments, setAdjustments] = useState<QuoteAdjustment[]>([]);
  // นาฬิกาสำหรับตรวจคำขอปรับราคาที่หมดอายุ (ทุก 30 วินาที)
  const [clockTick, setClockTick] = useState(0);

  const total = useMemo(() => {
    if (paymentMode === 'monthly' && sundayPackage) return 14100;
    if (paymentMode === 'single') return pricePerVisit(service, area, grassHeight);
    return monthlyPackagePrice(monthlyFrequency, area, grassHeight).price;
  }, [area, grassHeight, monthlyFrequency, paymentMode, service, sundayPackage]);

  const payable = paymentMode === 'monthly' ? total * prepaidMonths : total;
  const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);
  const quoteAddress = serviceAddresses.find((address) => address.id === quoteAddressId)
    ?? serviceAddresses.find((address) => address.isDefault)
    ?? serviceAddresses[0];

  function beginQuote() {
    if (!appointment) {
      setNotice('กรุณาเลือกวันนัดหมายก่อนดำเนินการต่อ');
      return;
    }
    setNotice('');
    setQuoteOpen(true);
  }

  function saveWorkerBase() {
    if (!workerBaseDraft.addressLine.trim() || !workerBaseDraft.province || !workerBaseDraft.amphoe) {
      setNotice('กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ');
      return;
    }
    if (!workerBaseDraft.location) {
      setNotice('กรุณาปักหมุดตำแหน่งที่อยู่ปัจจุบัน เพื่อใช้เป็นจุดฐานคำนวณระยะทางไปยังงาน');
      return;
    }
    setWorkerBase(workerBaseDraft);
    setEditingWorkerBase(false);
    setNotice('บันทึกที่อยู่ฐานของช่างแล้ว (ตัวอย่างหน้าจอ)');
  }

  const workerLocation = workerBase?.location ?? null;
  const jobsWithDistance = jobs
    .map((job) => ({ job, distance: workerLocation && job.address.location ? distanceKm(workerLocation, job.address.location) : null }))
    // เรียงตามวันนัดหมาย (เร็วสุดก่อน) แล้วตามเวลา · ถ้าวันเวลาเท่ากัน งานที่ใกล้กว่ามาก่อน
    .sort((a, b) => a.job.date.localeCompare(b.job.date) || (a.job.time ?? '').localeCompare(b.job.time ?? '') || (a.distance ?? Infinity) - (b.distance ?? Infinity));

  // ช่างรับงานได้วันละ 1 งาน
  const [confirmCancelJobId, setConfirmCancelJobId] = useState<number | null>(null);

  function releasePayout(jobId: number) {
    const job = myJobs.find((item) => item.id === jobId);
    if (!job || job.payoutReleasedAt) return;
    if (!canReleasePayout(job, reviews.some((review) => review.jobId === jobId))) {
      setNotice(`ยังโอนเงินไม่ได้ · ต้องรอลูกค้ารีวิว หรือครบ ${escrowReleaseDays} วันหลังทำงานเสร็จ`);
      return;
    }
    setMyJobs((current) => current.map((item) => item.id === jobId ? { ...item, payoutReleasedAt: new Date().toISOString() } : item));
    setNotice(`โอนเงิน ฿${money(netPayout(job.price))} เข้า ${workerBankLabel} เรียบร้อย (ตัวอย่างหน้าจอ)`);
  }

  // สำหรับทดสอบ: เลื่อนเวลาทำงานเสร็จย้อนหลัง เพื่อดูเงื่อนไขครบ 2 วัน
  function simulateEscrowWait(jobId: number) {
    setMyJobs((current) => current.map((item) => item.id === jobId && item.completedAt
      ? { ...item, completedAt: new Date(new Date(item.completedAt).getTime() - escrowReleaseDays * 86400000).toISOString() }
      : item));
  }

  function advanceWorkStage(job: Job) {
    const stage = job.workStage ?? 'matched';
    if (stage === 'done') return;
    const action = workStageActions[stage];
    setMyJobs((current) => current.map((item) => item.id === job.id ? { ...item, workStage: action.next, completedAt: action.next === 'done' ? new Date().toISOString() : item.completedAt } : item));
    setNotifications((current) => [{ id: Date.now(), jobId: job.id, kind: action.kind, message: action.message, createdAt: new Date().toISOString(), read: false }, ...current]);
    setJobStep((step) => Math.max(step, action.next === 'working' ? 2 : action.next === 'done' ? 3 : 1));
    setNotice(`แจ้งลูกค้า ${job.firstName} แล้ว: “${action.message}”`);
  }

  function submitReview(jobId: number) {
    setReviews((current) => [...current.filter((review) => review.jobId !== jobId), { jobId, rating: reviewRating, comment: reviewComment.trim(), createdAt: new Date().toISOString() }]);
    setReviewingJobId(null);
    setReviewComment('');
    setReviewRating(5);
    setJobStep(4);
    setNotice('ขอบคุณสำหรับรีวิว · งานเสร็จสมบูรณ์');
  }

  function toggleNotifications() {
    setNotificationsOpen(!notificationsOpen);
    setSettingsOpen(false);
    if (!notificationsOpen) setNotifications((current) => current.map((item) => (item.audience ?? 'customer') === 'customer' ? { ...item, read: true } : item));
  }

  function cancelJob(jobId: number) {
    const job = myJobs.find((item) => item.id === jobId);
    if (!job) return;
    setConfirmCancelJobId(null);
    if (!canWorkerCancel(job)) {
      setNotice(`ยกเลิกไม่ได้ · ช่างต้องยกเลิกก่อนวันนัดหมายอย่างน้อย ${workerCancelDaysBefore} วัน`);
      return;
    }
    setMyJobs((current) => current.filter((item) => item.id !== jobId));
    setJobs((current) => [...current, { ...job, status: 'รอรับงาน' }]);
    setAdjustments((current) => current.filter((adjustment) => adjustment.jobId !== jobId || adjustment.customerDecision !== 'pending'));
    setNotice(`ยกเลิกงาน “${job.title}” แล้ว · งานกลับไปที่ Job Pool`);
  }

  // งานของฉัน เรียงตามวันนัดหมาย (เร็วสุดก่อน) แล้วตามเวลา
  const sortedMyJobs = [...myJobs].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

  const bookedDates = new Set(myJobs.map((job) => job.date));

  function requestAdjustment(job: Job, request: { newAmount: number; newArea: number; newGrassHeight: number; newExtraCharges: number; reasons: string[]; note: string }) {
    setAdjustments((current) => [...current, {
      id: Date.now(),
      jobId: job.id,
      oldAmount: job.price,
      ...request,
      requestedBy: 'mechanic',
      customerDecision: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + adjustmentExpiryMinutes * 60000).toISOString(),
    }]);
    setNotice(`ส่งคำขอปรับราคา “${job.title}” ให้ลูกค้ายืนยันแล้ว · ราคายังไม่เปลี่ยนจนกว่าลูกค้าจะตอบรับ`);
  }

  // ราคาเปลี่ยนเมื่อลูกค้ายอมรับ และถ้าราคาสูงขึ้นต้องชำระส่วนต่างก่อน (PRD 5.3)
  function applyAdjustment(adjustment: QuoteAdjustment) {
    setMyJobs((current) => current.map((job) => job.id === adjustment.jobId
      ? { ...job, price: adjustment.newAmount, area: adjustment.newArea, grassHeight: adjustment.newGrassHeight, extraCharges: adjustment.newExtraCharges, priceNote: 'ปรับราคาหน้างานแล้ว' }
      : job));
  }

  // คำขอปรับราคาที่ลูกค้าไม่ตอบภายใน 1 ชั่วโมง → หมดอายุ ราคาคงเดิม และแจ้งช่าง
  function expireAdjustments(ids: number[]) {
    const expiring = adjustments.filter((item) => ids.includes(item.id) && item.customerDecision === 'pending');
    if (!expiring.length) return;
    setAdjustments((current) => current.map((item) => expiring.some((candidate) => candidate.id === item.id) ? { ...item, customerDecision: 'expired', decidedAt: new Date().toISOString() } : item));
    expiring.forEach((item) => notifyWorker(item.jobId, `คำขอปรับราคาหมดอายุ · ลูกค้าไม่ตอบภายใน 1 ชั่วโมง ราคายังเป็น ฿${money(item.oldAmount)}`));
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const due = adjustments.filter((item) => item.customerDecision === 'pending' && new Date(item.expiresAt).getTime() <= Date.now());
    if (due.length) expireAdjustments(due.map((item) => item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockTick, adjustments]);

  function decideAdjustment(adjustmentId: number, accept: boolean) {
    const adjustment = adjustments.find((item) => item.id === adjustmentId);
    if (!adjustment) return;
    if (adjustment.customerDecision === 'pending' && new Date(adjustment.expiresAt).getTime() <= Date.now()) {
      expireAdjustments([adjustmentId]);
      setNotice('คำขอปรับราคานี้หมดอายุแล้ว · ราคาคงเดิม');
      return;
    }
    const decidedAt = new Date().toISOString();
    if (!accept) {
      setAdjustments((current) => current.map((item) => item.id === adjustmentId ? { ...item, customerDecision: 'rejected', decidedAt } : item));
      notifyWorker(adjustment.jobId, `ลูกค้าปฏิเสธคำขอปรับราคา · ราคายังเป็น ฿${money(adjustment.oldAmount)}`);
      setNotice('ปฏิเสธคำขอปรับราคาแล้ว · แจ้งช่างเรียบร้อย (ตัวอย่างหน้าจอ)');
      return;
    }
    const difference = adjustment.newAmount - adjustment.oldAmount;
    const settlement = difference > 0 ? 'awaiting_payment' : difference < 0 ? 'refunded' : 'no_change';
    setAdjustments((current) => current.map((item) => item.id === adjustmentId ? { ...item, customerDecision: 'accepted', settlement, decidedAt } : item));
    if (difference > 0) {
      notifyWorker(adjustment.jobId, `ลูกค้ายอมรับคำขอปรับราคา ฿${money(adjustment.newAmount)} · รอลูกค้าชำระส่วนต่าง`);
      setNotice(`ยอมรับราคาใหม่แล้ว กรุณาชำระส่วนต่าง ฿${money(difference)} ผ่าน QR ก่อนช่างทำงานต่อ`);
      return;
    }
    applyAdjustment(adjustment);
    notifyWorker(adjustment.jobId, `ลูกค้ายอมรับคำขอปรับราคา · ราคาใหม่ ฿${money(adjustment.newAmount)}`);
    setNotice(difference < 0 ? `ยอมรับราคาใหม่แล้ว · คืนเงิน ฿${money(-difference)} เรียบร้อย (ตัวอย่างหน้าจอ)` : 'ยอมรับราคาใหม่แล้ว');
  }

  function payAdjustmentDifference(adjustmentId: number) {
    const adjustment = adjustments.find((item) => item.id === adjustmentId);
    if (!adjustment) return;
    setAdjustments((current) => current.map((item) => item.id === adjustmentId ? { ...item, settlement: 'paid_difference' } : item));
    applyAdjustment(adjustment);
    notifyWorker(adjustment.jobId, `ลูกค้าชำระส่วนต่างแล้ว · ราคาใหม่ ฿${money(adjustment.newAmount)} ดำเนินงานต่อได้`);
    setNotice(`ชำระส่วนต่าง ฿${money(adjustment.newAmount - adjustment.oldAmount)} สำเร็จ · ช่างดำเนินงานต่อได้`);
  }

  const openAdjustments = adjustments.filter((adjustment) => adjustment.customerDecision === 'pending' || adjustment.settlement === 'awaiting_payment');

  function acceptJob(jobId: number) {
    const accepted = jobs.find((job) => job.id === jobId);
    if (!accepted) return;
    if (!workerCanAcceptJobs) {
      setNotice('บัญชีช่างยังไม่ผ่านการตรวจสอบจากแอดมิน จึงยังรับงานไม่ได้');
      return;
    }
    if (bookedDates.has(accepted.date)) {
      setNotice(`คุณรับงานวันที่ ${formatThaiDate(accepted.date)} ไว้แล้ว ไม่สามารถรับงานเพิ่มในวันเดียวกันได้`);
      return;
    }
    setJobs((current) => current.filter((job) => job.id !== jobId));
    setMyJobs((current) => [...current, accepted]);
    setNotice(`รับงาน “${accepted.title}” แล้ว`);
  }

  function payQuote() {
    const jobId = Date.now();
    setPaid(true);
    setBooking({ jobId: quoteAddress ? jobId : null, amount: payable, date: appointment });
    if (quoteAddress) {
      setJobs((current) => [...current, {
        id: jobId,
        title: paymentMode === 'single' ? 'งานจ่ายครั้งเดียว' : 'งานแพ็กเกจรายเดือน',
        area: Math.max(Number(area) || 0, 0),
        grassHeight,
        isMonthly: paymentMode === 'monthly',
        date: appointment,
        firstName,
        lastName,
        phone: phone.replace(/\D/g, ''),
        address: quoteAddress.details,
        service: paymentMode === 'single' ? service : sundayPackage ? 'รายเดือน (หยุดวันอาทิตย์)' : `${monthlyPackageService} · ${monthlyFrequency} ครั้งต่อเดือน`,
        price: payable,
        priceNote: paymentMode === 'monthly' ? `ชำระล่วงหน้า ${prepaidMonths} เดือน` : undefined,
        photos: lawnPhotos.map((photo) => photo.url),
        status: 'รอรับงาน',
      }]);
    }
    setNotice('ชำระเงินตัวอย่างสำเร็จ งานถูกส่งเข้า Job Pool แล้ว');
  }

  // 0812345678 → 081-234-5678
function formatPhone(digits: string) {
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

// ลูกค้ายกเลิกการจ้างงานได้ก่อนวันนัดหมายอย่างน้อย 2 วัน และรับเงินคืนเข้าบัญชีที่ระบุ
  const bookedJob = booking?.jobId ? myJobs.find((job) => job.id === booking.jobId) : undefined;
  const workStarted = Boolean(bookedJob && (bookedJob.workStage ?? 'matched') !== 'matched');
  const myRating = workerRating(currentWorkerId, reviews.map((review) => review.rating));
  const assignedWorkerCard = bookedJob && (
    <WorkerCard name={workerName} photo={workerPhoto} rating={myRating.average} reviewCount={myRating.reviewCount} completedJobs={myRating.completedJobs} status={workStageLabels[bookedJob.workStage ?? 'matched']} />
  );
  const customerCanCancel = Boolean(booking) && daysFromToday(booking!.date) >= customerCancelDaysBefore && !workStarted;

  function cancelBooking() {
    if (!booking) return;
    if (!customerCanCancel) {
      setCancelError(`ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมายอย่างน้อย ${customerCancelDaysBefore} วัน`);
      return;
    }
    if (!refundBank) {
      setCancelError('กรุณาเลือกธนาคารสำหรับรับเงินคืน');
      return;
    }
    const accountDigits = refundAccount.replace(/\D/g, '');
    if (!/^\d{10,12}$/.test(accountDigits)) {
      setCancelError('กรุณากรอกเลขบัญชี 10–12 หลัก');
      return;
    }
    if (bookedJob) {
      notifyWorker(bookedJob.id, `ลูกค้ายกเลิกงาน “${bookedJob.title}” วันที่ ${formatThaiDate(bookedJob.date)} แล้ว · งานถูกนำออกจากงานของคุณ`);
    }
    if (booking.jobId) {
      setJobs((current) => current.filter((job) => job.id !== booking.jobId));
      setMyJobs((current) => current.filter((job) => job.id !== booking.jobId));
      setAdjustments((current) => current.filter((adjustment) => adjustment.jobId !== booking.jobId));
    }
    const message = `ยกเลิกการจ้างงานแล้ว · คืนเงิน ฿${money(booking.amount)} เข้า ${refundBank} xxx-${accountDigits.slice(-4)} (${firstName} ${lastName})`;
    setNotifications((current) => [{ id: Date.now(), kind: 'info', message, createdAt: new Date().toISOString(), read: false }, ...current]);
    setNotice(`${message} (ตัวอย่างหน้าจอ)`);
    setBooking(null);
    setPaid(false);
    setQuoteOpen(false);
    setCancelOpen(false);
    setCancelError('');
    setRefundAccount('');
  }

  function addServiceAddress() {
    if (!newAddressDetails.addressLine.trim() || !newAddressDetails.province || !newAddressDetails.amphoe) {
      setNotice('กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ');
      return;
    }
    setServiceAddresses((current) => [
      ...current.map((address) => ({ ...address, isDefault: newAddressDefault ? false : address.isDefault })),
      { id: Date.now(), label: newAddressLabel, details: newAddressDetails, isDefault: newAddressDefault || current.length === 0 },
    ]);
    setNewAddressDetails(emptyAddressDetails);
    setAddingAddress(false);
    setNotice('เพิ่มที่อยู่บริการเรียบร้อยแล้ว (ตัวอย่างหน้าจอ)');
  }

  function startAddressEdit(address: (typeof serviceAddresses)[number]) {
    setEditingAddressId(address.id);
    setEditAddressLabel(address.label);
    setEditAddressDetails({ ...address.details });
    setConfirmDeleteAddressId(null);
  }

  function saveAddressEdit(addressId: number) {
    if (!editAddressDetails.addressLine.trim() || !editAddressDetails.province || !editAddressDetails.amphoe) {
      setNotice('กรุณากรอกรายละเอียดที่อยู่ และเลือกจังหวัดกับเขต/อำเภอให้ครบ');
      return;
    }
    setServiceAddresses((current) => current.map((address) => address.id === addressId
      ? { ...address, label: editAddressLabel, details: editAddressDetails }
      : address));
    setEditingAddressId(null);
    setNotice('แก้ไขที่อยู่บริการเรียบร้อยแล้ว (ตัวอย่างหน้าจอ)');
  }

  function deleteServiceAddress(addressId: number) {
    if (serviceAddresses.length === 1) {
      setNotice('ต้องมีที่อยู่บริการอย่างน้อย 1 แห่ง');
      setConfirmDeleteAddressId(null);
      return;
    }
    setServiceAddresses((current) => {
      const remaining = current.filter((address) => address.id !== addressId);
      if (remaining.some((address) => address.isDefault)) return remaining;
      return remaining.map((address, index) => ({ ...address, isDefault: index === 0 }));
    });
    setConfirmDeleteAddressId(null);
    setNotice('ลบที่อยู่บริการเรียบร้อยแล้ว (ตัวอย่างหน้าจอ)');
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">LawnFlow</p>
          <h1 className="text-xl font-bold text-slate-900">Marketplace for lawn care</h1>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-expanded={notificationsOpen} onClick={toggleNotifications} className={buttonClass}>
            🔔 แจ้งเตือน {unreadCount > 0 && <span className="ml-1 rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
          </button>
          <Link href="/mobile-preview" className={`${buttonClass} border-slate-200 text-slate-700 hover:border-brand-500`}>📱 พรีวิวมือถือ</Link>
          <Link href="/admin" className={`${buttonClass} border-slate-200 text-slate-700 hover:border-brand-500`}>🛡️ แอดมิน</Link>
          <button type="button" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(!settingsOpen); setNotificationsOpen(false); }} className={buttonClass}>⚙️ ตั้งค่า</button>
        </div>
      </header>

      {(notificationsOpen || settingsOpen) && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" aria-live="polite">
          {notificationsOpen ? (
            <>
              <h2 className="text-lg font-bold text-slate-900">การแจ้งเตือน</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {customerNotifications.map((item) => {
                  const job = item.jobId ? myJobs.find((candidate) => candidate.id === item.jobId) : undefined;
                  const review = item.jobId ? reviews.find((candidate) => candidate.jobId === item.jobId) : undefined;
                  return (
                    <li key={item.id} className={`rounded-lg p-3 ${notificationStyles[item.kind]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span><span className="font-medium text-slate-900">{item.message}</span>{job && <span className="block text-xs text-slate-500">{job.title} · {job.service}</span>}</span>
                        {item.createdAt && <span className="shrink-0 text-xs text-slate-500">{formatTime(item.createdAt)}</span>}
                      </div>
                      {item.kind === 'completed' && job && (review ? (
                        <p className="mt-2 text-xs text-slate-600">รีวิวแล้ว <span className="text-amber-500">{'★'.repeat(review.rating)}</span>{review.comment && ` · “${review.comment}”`}</p>
                      ) : reviewingJobId === job.id ? (
                        <div className="mt-2 rounded-lg bg-white p-3">
                          <p className="text-xs font-semibold text-slate-700">ให้คะแนนบริการ</p>
                          <div className="mt-1 flex gap-1" role="radiogroup" aria-label="คะแนน">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} type="button" role="radio" aria-checked={reviewRating === star} aria-label={`${star} ดาว`} onClick={() => setReviewRating(star)} className={`text-2xl leading-none ${star <= reviewRating ? 'text-amber-500' : 'text-slate-300'}`}>★</button>
                            ))}
                          </div>
                          <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={2} placeholder="เล่าประสบการณ์การใช้บริการ (ไม่บังคับ)" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:outline-none" />
                          <div className="mt-2 flex gap-2"><button type="button" onClick={() => submitReview(job.id)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">ส่งรีวิว</button><button type="button" onClick={() => setReviewingJobId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">ไว้ทีหลัง</button></div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setReviewingJobId(job.id); setReviewRating(5); setReviewComment(''); }} className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600">⭐ รีวิวช่าง</button>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900">ตั้งค่าบัญชี</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">ชื่อ<input autoComplete="given-name" value={firstName} readOnly aria-readonly="true" className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 focus:outline-none" /></label>
                <label className="text-sm font-medium text-slate-700">นามสกุล<input autoComplete="family-name" value={lastName} readOnly aria-readonly="true" className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 focus:outline-none" /></label>
                <p className="text-xs text-slate-500 sm:col-span-2">ชื่อ-นามสกุลใช้ตามที่ลงทะเบียน และใช้เป็นชื่อบัญชีรับเงินคืน จึงแก้ไขไม่ได้ · หากต้องการเปลี่ยน กรุณาติดต่อแอดมิน</p>
                <label className="text-sm font-medium text-slate-700">เบอร์โทร<input autoComplete="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-brand-500 focus:outline-none" /></label>
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-semibold text-slate-900">ที่อยู่บริการ</h3><p className="mt-1 text-sm text-slate-600">เลือกที่อยู่หลัก หรือเพิ่มสถานที่ให้บริการใหม่</p></div>
                  <button type="button" onClick={() => { setAddingAddress(!addingAddress); setNotice(''); }} aria-expanded={addingAddress} className="rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">{addingAddress ? 'ยกเลิก' : '+ เพิ่มที่อยู่ใหม่'}</button>
                </div>
                <div className="mt-3 space-y-2">
                  {serviceAddresses.map((address) => (
                    <div key={address.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <input type="radio" name="default-service-address" checked={address.isDefault} onChange={() => setServiceAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === address.id })))} className="mt-1 accent-emerald-700" />
                          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">{address.label}{address.isDefault && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">ที่อยู่หลัก</span>}</span><span className="mt-1 block text-sm text-slate-600">{formatAddress(address.details)}</span></span>
                        </label>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => startAddressEdit(address)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700">แก้ไข</button>
                          <button type="button" onClick={() => { setConfirmDeleteAddressId(address.id); setEditingAddressId(null); }} className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">ลบ</button>
                        </div>
                      </div>
                      {editingAddressId === address.id && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3">
                          <label className="mb-3 block max-w-xs text-sm font-medium text-slate-700">ประเภทที่อยู่<select value={editAddressLabel} onChange={(event) => setEditAddressLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"><option>บ้าน</option><option>ที่ทำงาน</option><option>อื่นๆ</option></select></label>
                          <AddressEditor details={editAddressDetails} onChange={setEditAddressDetails} />
                          <div className="mt-3 flex gap-2"><button type="button" onClick={() => saveAddressEdit(address.id)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">บันทึกการแก้ไข</button><button type="button" onClick={() => setEditingAddressId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
                        </div>
                      )}
                      {confirmDeleteAddressId === address.id && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-3">
                          <p className="text-sm text-rose-800">ยืนยันลบที่อยู่นี้หรือไม่? การลบไม่สามารถเรียกคืนได้</p>
                          <div className="flex gap-2"><button type="button" onClick={() => deleteServiceAddress(address.id)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800">ยืนยันลบ</button><button type="button" onClick={() => setConfirmDeleteAddressId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {addingAddress && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-4">
                    <label className="mb-3 block max-w-xs text-sm font-medium text-slate-700">ประเภทที่อยู่<select value={newAddressLabel} onChange={(event) => setNewAddressLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"><option>บ้าน</option><option>ที่ทำงาน</option><option>อื่นๆ</option></select></label>
                    <AddressEditor details={newAddressDetails} onChange={setNewAddressDetails} />
                    <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={newAddressDefault} onChange={(event) => setNewAddressDefault(event.target.checked)} className="accent-emerald-700" />ตั้งเป็นที่อยู่หลัก</label>
                    <button type="button" onClick={addServiceAddress} className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">บันทึกที่อยู่นี้</button>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setSettingsOpen(false); setNotice(`บันทึกข้อมูลบัญชีแล้ว: ${firstName} ${lastName} · ${phone} (ตัวอย่างหน้าจอ)`); }} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">บันทึก</button>
            </>
          )}
        </section>
      )}

      {notice && (
        <div role="status" className="mb-6 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <span>{notice}</span>
          <button type="button" aria-label="ปิดข้อความ" onClick={() => setNotice('')} className="ml-4 font-bold">ปิด</button>
        </div>
      )}

      <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-sm font-medium text-brand-600">คำนวณราคา & จอง</p><h2 className="mt-1 text-3xl font-bold text-slate-900">บริการดูแลสวน</h2></div>
            <span className="badge bg-brand-100 text-brand-700">VIP priority</span>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">โหมดชำระ</p>
              <div className="flex gap-3">
                {([{ id: 'single', label: 'จ่ายครั้งเดียว' }, { id: 'monthly', label: 'แพ็กเกจรายเดือน' }] as const).map((mode) => (
                  <button key={mode.id} type="button" aria-pressed={paymentMode === mode.id} onClick={() => { setPaymentMode(mode.id); setQuoteOpen(false); setPaid(false); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${paymentMode === mode.id ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>{mode.label}</button>
                ))}
              </div>
            </div>

            {paymentMode === 'single' ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">ประเภทบริการ</p>
                <div className="grid grid-cols-2 gap-2">
                  {pricingOptions.map((option) => (
                    <button key={option.name} type="button" aria-pressed={service === option.name} onClick={() => setService(option.name)} className={`${buttonClass} text-left ${service === option.name ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                      {option.name}<span className="mt-1 block text-xs opacity-70">฿{money(option.basePrice)} (ไม่เกิน {baseAreaWa} ตารางวา) · เกินคิดเพิ่ม ตารางวาละ ฿{option.extraPerWa}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">เลือกแพ็กเกจ</p>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3].map((frequency) => {
                    const selected = !sundayPackage && monthlyFrequency === frequency;
                    const { fullPrice, price } = monthlyPackagePrice(frequency, area, grassHeight);
                    return (
                      <button key={frequency} type="button" aria-pressed={selected} onClick={() => { setSundayPackage(false); setMonthlyFrequency(frequency); }} className={`${buttonClass} text-left ${selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                        <span className="flex items-center justify-between gap-2">{frequency} ครั้งต่อเดือน<span className="badge bg-rose-100 text-rose-700">ลด {Math.round(monthlyDiscounts[frequency] * 100)}%</span></span>
                        <span className="mt-1 block text-xs"><span className="mr-1 text-slate-400 line-through">฿{money(fullPrice)}</span><span className="font-semibold">฿{money(price)}</span>/เดือน</span>
                        <span className="mt-0.5 block text-xs opacity-70">{monthlyPackageService}</span>
                      </button>
                    );
                  })}
                  <button type="button" aria-pressed={sundayPackage} onClick={() => setSundayPackage(true)} className={`${buttonClass} text-left ${sundayPackage ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500'}`}>
                    รายเดือน (หยุดวันอาทิตย์)<span className="mt-1 block text-xs opacity-70">฿14,100/เดือน · ราคาคงที่ ไม่ขึ้นกับพื้นที่</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label htmlFor="area" className="mb-2 block text-sm font-semibold text-slate-700">พื้นที่ (ตารางวา)</label>
              <input id="area" type="number" min="1" value={area} onChange={(event) => setArea(event.target.value)} disabled={paymentMode === 'monthly' && sundayPackage} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100" />
              {paymentMode === 'monthly' && sundayPackage && <span className="mt-1 block text-xs text-slate-500">แพ็กเกจนี้ราคาไม่ขึ้นกับพื้นที่</span>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label htmlFor="grass-height" className="mb-2 block text-sm font-semibold text-slate-700">ความสูงหญ้า</label>
              <select id="grass-height" value={grassHeight} onChange={(event) => setGrassHeight(Number(event.target.value))} disabled={paymentMode === 'monthly' && sundayPackage} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-100">
                <option value={0}>น้อยกว่า 6&quot; × 1.0</option><option value={1}>มากกว่า 6&quot; × 1.5</option><option value={2}>มากกว่า 12&quot; × 2.0</option>
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label htmlFor="appointment" className="mb-2 block text-sm font-semibold text-slate-700">วันนัดหมาย</label>
              <DateInput id="appointment" value={appointment} onChange={setAppointment} min={todayIsoDate()} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-500" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-medium text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>แนบรูปสนามหญ้า (ไม่บังคับ) <span className="font-normal text-slate-500">· สูงสุด {maxLawnPhotos} รูป</span></span>
              {lawnPhotos.length > 0 && <span className="text-xs text-brand-700">แนบแล้ว {lawnPhotos.length} รูป</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {lawnPhotos.map((photo, index) => (
                <div key={photo.url} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`รูปสนามหญ้า ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeLawnPhoto(photo.url)} aria-label={`ลบรูปที่ ${index + 1}`} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-xs font-bold text-white hover:bg-slate-900">✕</button>
                </div>
              ))}
              {lawnPhotos.length < maxLawnPhotos && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 hover:border-brand-500 hover:text-brand-700">
                  <span aria-hidden="true" className="text-2xl leading-none">＋</span>
                  <span className="mt-1">เพิ่มรูป</span>
                  <input type="file" accept="image/*" multiple onChange={(event) => { addLawnPhotos(event.target.files); event.target.value = ''; }} className="sr-only" />
                </label>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-emerald-50 p-4">
            {paymentMode === 'monthly' && (
              <div className="mb-4 border-b border-emerald-100 pb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-600">ราคาแพ็กเกจต่อเดือน</p>
                  <p className="text-lg font-bold text-slate-900">฿{money(total)}<span className="text-sm font-normal text-slate-500">/เดือน</span></p>
                </div>
                <fieldset className="mt-3" disabled={paid}>
                  <legend className="text-sm font-semibold text-slate-800">เลือกจำนวนเดือนที่ต้องการชำระ</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[3, 6, 12].map((months) => (
                      <button key={months} type="button" aria-pressed={prepaidMonths === months} onClick={() => setPrepaidMonths(months)} className={`rounded-xl border px-3 py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${prepaidMonths === months ? 'border-brand-600 bg-white text-brand-700 ring-2 ring-brand-500' : 'border-emerald-100 bg-white text-slate-700 hover:border-brand-500'}`}>
                        <span className="block text-base font-bold">{months} เดือน</span>
                        <span className="mt-0.5 block text-xs text-slate-500">฿{money(total * months)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">{paymentMode === 'monthly' ? `ยอดชำระ ${prepaidMonths} เดือน` : 'ราคารวมโดยประมาณ'}</p>
              <p className="mt-1 text-3xl font-bold text-brand-700">฿{money(payable)}</p>
              {paymentMode === 'monthly' && <p className="mt-0.5 text-xs text-slate-600">฿{money(total)} × {prepaidMonths} เดือน</p>}
              <p className="mt-1 text-xs text-slate-600">ราคาเพื่อสาธิต UI อาจเปลี่ยนหลังประเมินหน้างาน</p>
            </div>
            <button type="button" onClick={beginQuote} disabled={paid} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">{paid ? 'ชำระแล้ว' : 'ต่อไป: ใบเสนอราคา'}</button>
            </div>
          </div>

          {quoteOpen && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-white p-5" aria-live="polite">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-lg font-bold text-slate-900">ใบเสนอราคา</h3><p className="mt-1 text-sm text-slate-600">{paymentMode === 'single' ? `${service} · ${area || 0} ตร.วา` : sundayPackage ? 'รายเดือน (หยุดวันอาทิตย์)' : `${monthlyFrequency} ครั้งต่อเดือน`} · {formatThaiDate(appointment)}</p></div>
                <button type="button" aria-label="ปิดใบเสนอราคา" onClick={() => setQuoteOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-900">ปิด</button>
              </div>
              <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">ชื่อ-นามสกุล</dt><dd className="mt-0.5 font-semibold text-slate-900">{firstName} {lastName}</dd></div>
                <div><dt className="text-slate-500">เบอร์โทร</dt><dd className="mt-0.5 font-semibold text-slate-900">{phone}</dd></div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">ที่อยู่บริการ</dt>
                  <dd className="mt-1">
                    {!quoteAddress ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-amber-800">ยังไม่มีที่อยู่บริการ กรุณาเพิ่มในเมนูตั้งค่า</p>
                    ) : choosingQuoteAddress ? (
                      <fieldset className="rounded-lg border border-brand-200 p-3">
                        <legend className="px-1 text-sm font-semibold text-slate-800">เลือกที่อยู่บริการ</legend>
                        <div className="space-y-2">
                          {serviceAddresses.map((address) => (
                            <label key={address.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${address.id === quoteAddress.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-500'}`}>
                              <input type="radio" name="quote-address" checked={address.id === quoteAddress.id} onChange={() => { setQuoteAddressId(address.id); setChoosingQuoteAddress(false); }} className="mt-1 accent-emerald-700" />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">{address.label}{address.isDefault && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">ที่อยู่หลัก</span>}</span>
                                <span className="mt-0.5 block text-slate-600">{formatAddress(address.details)}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <button type="button" onClick={() => setChoosingQuoteAddress(false)} className="mt-2 text-sm font-semibold text-slate-500 hover:text-slate-900">ยกเลิก</button>
                      </fieldset>
                    ) : (
                      <>
                        <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-slate-800">
                          <p className="min-w-0 flex-1"><span className="font-semibold">{quoteAddress.label}</span> · {formatAddress(quoteAddress.details)}</p>
                          {serviceAddresses.length > 1 && !paid && <button type="button" onClick={() => setChoosingQuoteAddress(true)} className="shrink-0 rounded-md border border-brand-600 px-3 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50">เปลี่ยน</button>}
                        </div>
                        <AddressMap details={quoteAddress.details} className="mt-2" />
                      </>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-600">ยอดชำระผ่าน QR</span><strong className="text-xl text-slate-900">฿{money(payable)}</strong></div>
              {paid ? (
                <div className="mt-4">
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{bookedJob ? 'ชำระสำเร็จ · มีช่างรับงานแล้ว' : 'ชำระสำเร็จ · ส่งงานเข้าคิว Job Pool แล้ว รอช่างรับงาน'}</p>
                  {assignedWorkerCard && <div className="mt-3">{assignedWorkerCard}</div>}
                  {booking && (cancelOpen ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
                      <p className="font-semibold text-rose-900">ยกเลิกการจ้างงาน</p>
                      <p className="mt-1 text-sm text-rose-800">คืนเงิน <span className="font-bold">฿{money(booking.amount)}</span> เข้าบัญชีที่ระบุ</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">ธนาคาร<select value={refundBank} onChange={(event) => { setRefundBank(event.target.value); setCancelError(''); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"><option value="">เลือกธนาคาร</option>{thaiBanks.map((bank) => <option key={bank}>{bank}</option>)}</select></label>
                        <label className="block text-sm font-medium text-slate-700">เลขที่บัญชี<input value={refundAccount} onChange={(event) => { setRefundAccount(event.target.value); setCancelError(''); }} inputMode="numeric" placeholder="xxx-x-xxxxx-x" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" /></label>
                        <label className="block text-sm font-medium text-slate-700">ชื่อบัญชี<input value={`${firstName} ${lastName}`} readOnly aria-readonly="true" className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700" /><span className="mt-0.5 block text-xs font-normal text-slate-500">ใช้ชื่อ-นามสกุลตามที่ลงทะเบียน</span></label>
                      </div>
                      {cancelError && <p role="alert" className="mt-2 text-sm text-rose-700">{cancelError}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={cancelBooking} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">ยืนยันยกเลิกและขอเงินคืน</button>
                        <button type="button" onClick={() => { setCancelOpen(false); setCancelError(''); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">ไม่ยกเลิก</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">{customerCanCancel ? `ยกเลิกได้ถึงวันที่ ${formatThaiDate(isoDateBefore(booking.date, customerCancelDaysBefore))}` : workStarted ? 'ช่างเริ่มงานแล้ว ยกเลิกไม่ได้' : `ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมาย ${customerCancelDaysBefore} วัน`}</span>
                      <button type="button" onClick={() => { setCancelOpen(true); setCancelError(''); }} disabled={!customerCanCancel} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent">ยกเลิกการจ้างงาน</button>
                    </div>
                  ))}
                </div>
              ) :<button type="button" onClick={payQuote} className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">จำลองสแกน QR ชำระเงิน</button>}
            </div>
          )}
        </div>

        <aside className="card p-6">
          <h2 className="text-lg font-bold text-slate-900">แพ็กเกจดูแลสวน</h2>
          <button type="button" onClick={() => { setPaymentMode('monthly'); setSundayPackage(true); setQuoteOpen(false); setPaid(false); }} aria-pressed={paymentMode === 'monthly' && sundayPackage} className={`mt-4 w-full rounded-2xl p-5 text-left text-white transition-colors ${paymentMode === 'monthly' && sundayPackage ? 'bg-emerald-800' : 'bg-slate-900 hover:bg-slate-800'}`}>
            <span className="text-sm text-emerald-100">รายเดือน หยุดวันอาทิตย์</span><span className="mt-3 block text-4xl font-bold">฿14,100</span><span className="mt-2 block text-sm text-slate-200">ราคาคงที่ ไม่ขึ้นกับพื้นที่</span><span className="mt-2 block text-sm text-slate-200">รดน้ำ · กวาดใบไม้ · ถอนวัชพืช · ตัดหญ้า · แต่งกิ่ง</span>
          </button>
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">ความถี่รายเดือน</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3].map((frequency) => <button key={frequency} type="button" onClick={() => { setPaymentMode('monthly'); setSundayPackage(false); setMonthlyFrequency(frequency); }} aria-pressed={paymentMode === 'monthly' && !sundayPackage && monthlyFrequency === frequency} className={`${buttonClass} ${paymentMode === 'monthly' && !sundayPackage && monthlyFrequency === frequency ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-700 hover:border-brand-500'}`}>{frequency} ครั้งต่อเดือน</button>)}
            </div>
          </div>
        </aside>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="section-title">ติดตามสถานะงาน</h2>
          {assignedWorkerCard && <div className="mt-4">{assignedWorkerCard}</div>}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {customerSteps.map((step, index) => <div key={step} className={`rounded-xl border p-3 text-center ${index <= jobStep ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}><div className={`mb-2 h-2 rounded-full ${index <= jobStep ? 'bg-brand-500' : 'bg-slate-200'}`} /><p className="text-sm font-medium text-slate-700">{step}</p></div>)}
          </div>
          <button type="button" onClick={() => setJobStep((step) => Math.min(step + 1, customerSteps.length - 1))} disabled={jobStep === customerSteps.length - 1} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-500 disabled:opacity-50">จำลองอัปเดตสถานะงาน</button>
          {openAdjustments.length > 0 && (
            <div className="mt-6 space-y-3" aria-live="polite">
              {openAdjustments.map((adjustment) => {
                const job = myJobs.find((item) => item.id === adjustment.jobId);
                return job && <AdjustmentDecision key={adjustment.id} job={job} adjustment={adjustment} onDecide={(accept) => decideAdjustment(adjustment.id, accept)} onPayDifference={() => payAdjustmentDifference(adjustment.id)} onSimulateExpiry={() => expireAdjustments([adjustment.id])} />;
              })}
            </div>
          )}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-700">เหตุการณ์ที่ต้องจัดการ</p><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700"><li>แจ้งเตือนฝนตก / เลื่อนงานอัตโนมัติ</li><li>ช่างขอปรับราคาหน้างาน</li><li>ยกเลิกงาน + คืนเงินแบบ rolling cycle</li></ul></div>
        </div>

        <div id="job-pool" className="card scroll-mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">งานใหม่ใน Job Pool</h2>
            <div className="flex items-center gap-2">
              <button type="button" aria-expanded={workerNotificationsOpen} onClick={toggleWorkerNotifications} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500">
                🔔 แจ้งเตือนช่าง {workerUnreadCount > 0 && <span className="ml-1 rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">{workerUnreadCount}</span>}
              </button>
              <span className="badge bg-brand-100 text-brand-700">{jobs.length} งาน</span>
            </div>
          </div>
          {workerNotificationsOpen && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3" aria-live="polite">
              {workerNotifications.length ? (
                <ul className="space-y-2 text-sm">
                  {workerNotifications.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3">
                      <span className="text-slate-800">{item.message}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatTime(item.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="p-2 text-sm text-slate-500">ยังไม่มีแจ้งเตือน</p>}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">ราคาที่แสดงเป็นราคาสุทธิ หลังหักค่า Platform {platformFeePercent}%</p><Link href="/worker-earnings" className="text-sm font-medium text-brand-700 hover:underline">💰 รายงานรายรับของฉัน →</Link></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 text-slate-600">{workerBase ? <>📍 จุดฐาน: {formatAddress(workerBase)}</> : 'ยังไม่มีที่อยู่ฐาน กรุณาลงทะเบียนที่อยู่ปัจจุบันในส่วน “สมัครเป็นช่าง”'}</span>
            <a href="#worker-registration" className="whitespace-nowrap font-medium text-brand-700 hover:underline">{workerBase ? 'เปลี่ยนจุดฐาน' : 'ลงทะเบียนที่อยู่'}</a>
          </div>
          <div className="mt-3 space-y-3">
            {jobsWithDistance.length ? jobsWithDistance.map(({ job, distance }) => (
              <div key={job.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2 text-xs">
                  <span className="font-medium text-slate-600">📅 {jobWhen(job)} · {job.title}</span>
                  <span className="badge shrink-0 bg-amber-100 text-amber-700">{job.status}</span>
                </div>
                <div className="px-4 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{job.service} <span className="whitespace-nowrap text-slate-600">{money(job.area)} ตารางวา</span> <span className="whitespace-nowrap text-slate-600">· หญ้า{grassHeightLabels[job.grassHeight]}</span></p>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold leading-tight text-brand-700">฿{money(netPayout(job.price))}</p>
                      {job.priceNote && <p className="text-xs text-slate-500">{job.priceNote}</p>}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                    <li className="flex gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-center">👤</span><span><span className="sr-only">ลูกค้า: </span>{job.firstName} {job.lastName}</span></li>
                    <li className="flex gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-center">📍</span><span><span className="sr-only">ที่อยู่บริการ: </span>{formatAddress(job.address)} <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(job.address))}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-medium text-brand-700 hover:underline">แผนที่ ↗</a></span></li>
                    <li className="flex gap-2"><span aria-hidden="true" className="w-5 shrink-0 text-center">🚗</span><span><span className="sr-only">ระยะทาง: </span>
                      {distance !== null
                        ? <><span className="font-semibold text-slate-900">ห่าง {formatDistance(distance)}</span> <span className="text-xs text-slate-500">(เส้นตรง)</span> <a href={`https://www.google.com/maps/dir/?api=1&origin=${workerLocation!.lat},${workerLocation!.lng}&destination=${encodeURIComponent(mapQuery(job.address))}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-medium text-brand-700 hover:underline">ดูเส้นทาง ↗</a></>
                        : <span className="text-slate-500">{!workerLocation ? 'ลงทะเบียนที่อยู่ฐานก่อน' : 'ลูกค้ายังไม่ได้ปักหมุดตำแหน่ง'}</span>}
                    </span></li>
                  </ul>
                  {job.photos && job.photos.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`รูปสนามหญ้า ${job.photos.length} รูป`}>
                      {job.photos.map((url, index) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`รูปสนามหญ้า ${index + 1}`} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                  {!workerCanAcceptJobs && <span className="text-xs text-amber-700">{workerStatus === 'rejected' ? 'ใบสมัครไม่ผ่านการอนุมัติ' : 'รอแอดมินอนุมัติบัญชีก่อนรับงาน'}</span>}
                  {bookedDates.has(job.date) && <span className="text-xs text-rose-700">คุณมีงานวันที่ {formatThaiDate(job.date)} แล้ว · รับได้วันละ 1 งาน</span>}
                  <button type="button" onClick={() => acceptJob(job.id)} disabled={!workerCanAcceptJobs || bookedDates.has(job.date)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">{bookedDates.has(job.date) ? 'ไม่ว่าง' : 'รับงาน'}</button>
                </div>
              </div>
            )) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">ไม่มีงานใหม่ใน Job Pool</p>}
          </div>
          {myJobs.length > 0 && <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="font-bold text-slate-900">งานของฉัน</h3><div className="mt-3 space-y-2">{sortedMyJobs.map((job) => {
            const cancellable = canWorkerCancel(job);
            const stage = job.workStage ?? 'matched';
            const action = stage === 'done' ? null : workStageActions[stage];
            // ราคาสูงขึ้นและลูกค้ายังไม่ชำระส่วนต่าง → ห้ามทำงานต่อ (PRD 5.3)
            const blocked = openAdjustments.some((adjustment) => adjustment.jobId === job.id);
            const review = reviews.find((item) => item.jobId === job.id);
            return (
              <div key={job.id} className="rounded-lg bg-brand-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-800">{job.title} · {jobWhen(job)}</span><span className="text-brand-700">{workStageLabels[stage]} · ลูกค้า {job.firstName} {job.lastName}</span></div>
                <p className="mt-1 text-slate-600">{formatAddress(job.address)}</p>
                {job.phone && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-slate-700">📞 <span className="font-semibold tabular-nums text-slate-900">{formatPhone(job.phone)}</span></span>
                    <a href={`tel:${job.phone}`} className="rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700">โทรหาลูกค้า</a>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {stage === 'matched' && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(job.address))}&travelmode=driving`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-brand-600 bg-white px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">🧭 นำทางจากตำแหน่งปัจจุบัน</a>}
                  {action && <button type="button" onClick={() => advanceWorkStage(job)} disabled={blocked} className="rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">{action.label}</button>}
                  {action && blocked && <span className="text-xs text-amber-700">รอลูกค้าตอบคำขอปรับราคา/ชำระส่วนต่างก่อน</span>}
                  {stage === 'done' && <span className="text-xs text-slate-600">{review ? <>ลูกค้ารีวิว <span className="text-amber-500">{'★'.repeat(review.rating)}</span>{review.comment && ` · “${review.comment}”`}</> : 'แจ้งลูกค้าแล้ว · รอลูกค้ารีวิว'}</span>}
                </div>
                {stage === 'done' && (() => {
                  const net = netPayout(job.price);
                  const releasable = canReleasePayout(job, Boolean(review));
                  return (
                    <div className={`mt-2 rounded-lg border p-3 ${job.payoutReleasedAt ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-700">🔒 Escrow · เงินของคุณ <span className="font-bold text-brand-700">฿{money(net)}</span></span>
                        {job.payoutReleasedAt
                          ? <span className="badge bg-emerald-100 text-emerald-800">✓ โอนแล้ว</span>
                          : <button type="button" onClick={() => releasePayout(job.id)} disabled={!releasable} className="rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300">💸 โอนเงินเข้าบัญชี</button>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.payoutReleasedAt
                          ? `โอนเข้า ${workerBankLabel} เมื่อ ${formatLocalDateTime(job.payoutReleasedAt)}`
                          : review
                            ? 'ลูกค้ารีวิวแล้ว · กดโอนเงินได้ทันที'
                            : releasable
                              ? `ครบ ${escrowReleaseDays} วันหลังทำงานเสร็จ · กดโอนเงินได้แล้ว`
                              : `โอนได้เมื่อลูกค้ารีวิว หรือหลัง ${formatLocalDateTime(payoutAvailableAt(job))} (${escrowReleaseDays} วันหลังทำงานเสร็จ)`}
                      </p>
                      {!job.payoutReleasedAt && !releasable && <button type="button" onClick={() => simulateEscrowWait(job.id)} className="mt-1 text-xs text-slate-400 underline hover:text-slate-600">(ทดสอบ) จำลองเวลาผ่านไป {escrowReleaseDays} วัน</button>}
                    </div>
                  );
                })()}
                {stage !== 'matched' ? null : confirmCancelJobId === job.id ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 p-2">
                    <span className="text-rose-800">ยืนยันยกเลิกงานนี้? งานจะกลับไปที่ Job Pool ให้ช่างคนอื่นรับ</span>
                    <span className="flex gap-2"><button type="button" onClick={() => cancelJob(job.id)} className="rounded-md bg-rose-700 px-3 py-1.5 font-semibold text-white hover:bg-rose-800">ยืนยันยกเลิก</button><button type="button" onClick={() => setConfirmCancelJobId(null)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700">ไม่ยกเลิก</button></span>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs text-slate-500">{cancellable ? `ยกเลิกได้ถึงวันที่ ${formatThaiDate(cancelDeadline(job))}` : `ยกเลิกไม่ได้ · ต้องยกเลิกก่อนวันนัดหมาย ${workerCancelDaysBefore} วัน`}</span>
                    <button type="button" onClick={() => setConfirmCancelJobId(job.id)} disabled={!cancellable} className="rounded-md border border-rose-200 bg-white px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white">ยกเลิก</button>
                  </div>
                )}
              </div>
            );
          })}</div></div>}
        </div>
      </section>

      <section id="inspection" className="card mb-8 scroll-mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">ตรวจงานและปรับราคา</h2>
            <p className="mt-1 text-sm text-slate-600">สำหรับช่าง · อัปโหลดภาพก่อน-หลัง ตรวจด้วย AI และขอปรับราคาหน้างานให้ลูกค้ายืนยัน</p>
          </div>
          <span className="badge bg-brand-100 text-brand-700">{myJobs.length} งานของฉัน</span>
        </div>
        {myJobs.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {sortedMyJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs text-slate-500">📅 {jobWhen(job)} · {job.title} · {job.firstName} {job.lastName}</p>
                    <p className="mt-1 font-semibold text-slate-900">{job.service} <span className="whitespace-nowrap text-slate-600">{money(job.area)} ตารางวา</span></p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">ลูกค้าจ่าย <span className="font-semibold text-slate-700">฿{money(job.price)}</span></p>
                    <p className="text-xs text-slate-500">คุณได้รับ <span className="text-lg font-bold text-brand-700">฿{money(netPayout(job.price))}</span></p>
                    {job.priceNote && <p className="text-xs text-slate-500">{job.priceNote}</p>}
                  </div>
                </div>
                <div className="pt-3">
                  <InspectionPanel job={job} adjustments={adjustments.filter((adjustment) => adjustment.jobId === job.id)} onRequestAdjustment={(request) => requestAdjustment(job, request)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีงาน · กด “รับงาน” จาก Job Pool ด้านบนก่อน แล้วงานจะแสดงที่นี่เพื่อตรวจงาน</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6"><h2 className="text-xl font-bold text-slate-900">ลงทะเบียนลูกค้า</h2><ul className="mt-4 space-y-2 text-sm text-slate-700"><li>ชื่อ เบอร์โทร อีเมล รหัสผ่าน และที่อยู่</li><li>OTP 6 หลัก ขอใหม่ได้ทุก 60 วินาที</li><li>ยืนยันสำเร็จแล้วตั้ง `phone_verified: true`</li></ul>
          {customerRegistered
            ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">ลงทะเบียนแล้ว · {firstName} {lastName}</p>
            : <Link href="/register-customer" className="mt-4 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">ลงทะเบียนลูกค้า →</Link>}
        </div>
        <div id="worker-registration" className="card scroll-mt-6 p-6">
          <h2 className="text-xl font-bold text-slate-900">สมัครเป็นช่าง</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700"><li>ข้อมูลบัญชีธนาคาร รัศมีงาน และที่อยู่ฐาน</li><li>แนบรูปบัตรประชาชนเพื่อยืนยันตัวตน</li><li>สถานะ Pending Verification ก่อนรับงาน</li></ul>
          {workerStatus === 'pending_verification' ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">⏳ ส่งใบสมัครแล้ว · รอแอดมินตรวจสอบ · ยังรับงานไม่ได้</p>
          ) : workerStatus === 'verified' ? (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">✓ แอดมินอนุมัติแล้ว · รับงานได้</p>
          ) : workerStatus === 'rejected' ? (
            <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              <p>✕ ใบสมัครไม่ผ่านการอนุมัติ{workerRejectReason && ` · ${workerRejectReason}`}</p>
              <Link href="/register-worker" className="mt-2 inline-block font-semibold text-rose-900 underline">สมัครใหม่ →</Link>
            </div>
          ) : (
            <Link href="/register-worker" className="mt-4 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">สมัครเป็นช่างตัดหญ้า →</Link>
          )}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="font-semibold text-slate-900">ที่อยู่ปัจจุบัน (จุดฐาน)</h3>
            <p className="mt-1 text-xs text-slate-500">ใช้คำนวณระยะทางไปยังสถานที่บริการ ให้ช่างทราบก่อนกดรับงาน · ต้องปักหมุดตำแหน่ง</p>
            {editingWorkerBase ? (
              <div className="mt-3">
                <AddressEditor details={workerBaseDraft} onChange={setWorkerBaseDraft} />
                <div className="mt-3 flex gap-2"><button type="button" onClick={saveWorkerBase} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">บันทึกที่อยู่ฐาน</button><button type="button" onClick={() => setEditingWorkerBase(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">ยกเลิก</button></div>
              </div>
            ) : (
              <div className="mt-3">
                {workerBase ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">📍 {formatAddress(workerBase)}</p> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">ยังไม่ได้ระบุที่อยู่ฐาน</p>}
                <button type="button" onClick={() => { setWorkerBaseDraft(workerBase ?? emptyAddressDetails); setEditingWorkerBase(true); }} className="mt-3 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">{workerBase ? 'แก้ไขที่อยู่ฐาน' : '+ ระบุที่อยู่ปัจจุบัน'}</button>
              </div>
            )}
          </div>
        </div>
        <div className="card p-6"><h2 className="text-xl font-bold text-slate-900">ตรวจงานและปรับราคา</h2><ul className="mt-4 space-y-2 text-sm text-slate-700"><li>อัปโหลดภาพก่อน-หลัง และตรวจด้วย AI (จำลอง)</li><li>ขอปรับราคา: พื้นที่จริง ความสูงหญ้าจริง เคลียร์เศษวัสดุ ฿200/ชม.</li><li>ราคาเปลี่ยนเมื่อลูกค้ายอมรับเท่านั้น</li></ul><a href="#inspection" className="mt-4 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">ไปที่ตรวจงาน →</a></div>
      </section>
    </main>
  );
}
