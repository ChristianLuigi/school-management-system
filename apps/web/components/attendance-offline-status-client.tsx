"use client";

import { useEffect, useState } from "react";
import {
  ATTENDANCE_QUEUE_UPDATED_EVENT,
  clearAttendanceQueue,
  getQueuedAttendanceSubmissions,
  syncQueuedAttendanceSubmissions,
  type QueuedAttendanceSubmission,
} from "@/lib/attendance-offline-queue";

export function AttendanceOfflineStatusClient({
  onSynced,
}: {
  onSynced?: () => void;
}) {
  const [queue, setQueue] = useState<QueuedAttendanceSubmission[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function refreshQueue() {
    setQueue(getQueuedAttendanceSubmissions());
  }

  async function syncNow() {
    setSyncing(true);
    setMessage("");
    setError("");

    try {
      const result = await syncQueuedAttendanceSubmissions();

      refreshQueue();

      if (result.failed > 0) {
        setError(
          `${result.synced} submission(s) synced, ${result.failed} still failed.`,
        );
      } else {
        setMessage(`${result.synced} pending submission(s) synced.`);
        onSynced?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  function clearQueue() {
    clearAttendanceQueue();
    refreshQueue();
    setMessage("Local attendance queue cleared.");
    setError("");
  }

  useEffect(() => {
    refreshQueue();

    function handleOnline() {
      setIsOnline(true);
      refreshQueue();
    }

    function handleOffline() {
      setIsOnline(false);
      refreshQueue();
    }

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(ATTENDANCE_QUEUE_UPDATED_EVENT, refreshQueue);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(ATTENDANCE_QUEUE_UPDATED_EVENT, refreshQueue);
    };
  }, []);

  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const pendingCount = queue.filter((item) => item.status === "PENDING").length;
  const failedCount = queue.filter((item) => item.status === "FAILED").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Low-Bandwidth Sync Status
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {isOnline ? "Online" : "Offline"} | {queue.length} queued |{" "}
            {pendingCount} pending | {failedCount} failed
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing || queue.length === 0}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          <button
            type="button"
            onClick={clearQueue}
            disabled={queue.length === 0}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Clear Queue
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {queue.length > 0 ? (
        <div className="mt-4 space-y-2">
          {queue.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
            >
              <div className="font-medium">
                {item.payload.attendanceDate} | {item.payload.slot}
              </div>
              <div className="mt-1">
                Records: {item.payload.records.length} | Attempts:{" "}
                {item.attempts} | Status: {item.status}
              </div>
              {item.lastError ? (
                <div className="mt-1 text-red-700">{item.lastError}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
