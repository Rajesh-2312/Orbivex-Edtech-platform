/**
 * useRealtime — Supabase Realtime subscriptions for live platform features
 *
 * Channels exposed:
 *   useNotifications(userId, onNew)    — live bell badge updates
 *   useProgress(userId, onUpdate)      — live lesson completion events
 *   useTestResult(submissionId, onResult) — live grading result
 *   useDriveUpdates(collegeId, onUpdate)  — live placement drive status
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ── Generic channel helper ────────────────────────────────────────────────────

function useChannel(channelName, subscribe, deps = []) {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!channelName) return;

    const channel = supabase.channel(channelName);
    subscribe(channel);
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, ...deps]);

  return channelRef;
}

// ── Notifications ─────────────────────────────────────────────────────────────

/**
 * Subscribe to new notifications for a user.
 * onNew(notification) is called whenever a new row is inserted.
 */
export function useNotifications(userId, onNew) {
  useChannel(
    userId ? `notifications:${userId}` : null,
    (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        ({ new: row }) => onNew?.(row)
      );
    },
    [userId]
  );
}

// ── Lesson Progress ───────────────────────────────────────────────────────────

/**
 * Subscribe to progress completions for a user.
 * onUpdate({ lesson_id, completed, completed_at }) is called on INSERT or UPDATE.
 */
export function useProgress(userId, onUpdate) {
  useChannel(
    userId ? `progress:${userId}` : null,
    (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'progress',
          filter: `user_id=eq.${userId}`,
        },
        ({ new: row }) => onUpdate?.(row)
      );
    },
    [userId]
  );
}

// ── Test / Quiz Result ────────────────────────────────────────────────────────

/**
 * Subscribe to a specific test submission being evaluated.
 * onResult(submission) fires when status changes to 'evaluated'.
 */
export function useTestResult(submissionId, onResult) {
  useChannel(
    submissionId ? `test_submission:${submissionId}` : null,
    (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'test_submissions',
          filter: `id=eq.${submissionId}`,
        },
        ({ new: row }) => {
          if (row.status === 'evaluated') onResult?.(row);
        }
      );
    },
    [submissionId]
  );
}

// ── Placement Drive Updates ───────────────────────────────────────────────────

/**
 * Subscribe to placement_drives changes for a college.
 * onUpdate(drive) is called on any INSERT / UPDATE for that college.
 */
export function useDriveUpdates(collegeId, onUpdate) {
  useChannel(
    collegeId ? `drives:${collegeId}` : null,
    (channel) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'placement_drives',
          filter: `college_id=eq.${collegeId}`,
        },
        ({ new: row, eventType }) => onUpdate?.(row, eventType)
      );
    },
    [collegeId]
  );
}
