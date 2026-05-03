export type AttendanceSubmissionPayload = {
  schoolId: string;
  sectionId: string;
  attendanceDate: string;
  slot: "MORNING" | "AFTERNOON";
  takenByUserId: string;
  records: Array<{
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
    note?: string;
  }>;
};

export type QueuedAttendanceSubmission = {
  id: string;
  queueKey: string;
  payload: AttendanceSubmissionPayload;
  status: "PENDING" | "FAILED";
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "school_attendance_offline_queue";
export const ATTENDANCE_QUEUE_UPDATED_EVENT = "attendance-queue-updated";

function safeRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyQueueUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ATTENDANCE_QUEUE_UPDATED_EVENT));
}

export function buildAttendanceQueueKey(payload: AttendanceSubmissionPayload) {
  return [
    payload.schoolId,
    payload.sectionId,
    payload.attendanceDate,
    payload.slot,
  ].join(":");
}

export function getQueuedAttendanceSubmissions(): QueuedAttendanceSubmission[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAttendanceSubmission[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  notifyQueueUpdated();
}

export function upsertQueuedAttendanceSubmission(
  payload: AttendanceSubmissionPayload,
) {
  const queue = getQueuedAttendanceSubmissions();
  const queueKey = buildAttendanceQueueKey(payload);
  const now = new Date().toISOString();

  const existingIndex = queue.findIndex((item) => item.queueKey === queueKey);

  if (existingIndex >= 0) {
    queue[existingIndex] = {
      ...queue[existingIndex],
      payload,
      status: "PENDING",
      updatedAt: now,
      lastError: undefined,
    };

    saveQueue(queue);
    return queue[existingIndex];
  }

  const item: QueuedAttendanceSubmission = {
    id: safeRandomId(),
    queueKey,
    payload,
    status: "PENDING",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  queue.unshift(item);
  saveQueue(queue);

  return item;
}

export function removeQueuedAttendanceSubmission(id: string) {
  const queue = getQueuedAttendanceSubmissions();
  saveQueue(queue.filter((item) => item.id !== id));
}

export function clearAttendanceQueue() {
  saveQueue([]);
}

export async function syncQueuedAttendanceSubmissions() {
  const queue = getQueuedAttendanceSubmissions();

  const results: Array<{
    id: string;
    ok: boolean;
    error?: string;
  }> = [];

  const nextQueue: QueuedAttendanceSubmission[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(`/api/attendance/sessions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item.payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          body?.message ?? body?.error ?? "Attendance sync failed.",
        );
      }

      results.push({
        id: item.id,
        ok: true,
      });
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Attendance sync failed.";

      nextQueue.push({
        ...item,
        status: "FAILED",
        attempts: item.attempts + 1,
        lastError: error,
        updatedAt: new Date().toISOString(),
      });

      results.push({
        id: item.id,
        ok: false,
        error,
      });
    }
  }

  saveQueue(nextQueue);

  return {
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}
