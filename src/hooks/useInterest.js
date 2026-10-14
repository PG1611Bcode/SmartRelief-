import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

export function useInterest(currentUser, setToast, onSuccess, refetchAll) {
  const [interestLoading, setInterestLoading] = useState({});
  const [interestedMissions, setInterestedMissions] = useState({});

  const handleInterest = async (needId) => {
    const interestKey = `${currentUser?.uid}_${needId}`;
    if (!currentUser?.uid || interestLoading[needId] || interestedMissions[interestKey]) return;

    setInterestLoading((prev) => ({ ...prev, [needId]: true }));
    try {
      const idToken = await currentUser?.getIdToken?.();
      const res = await fetch(`${API_BASE_URL}/api/interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          'X-User-UID': currentUser.uid,
        },
        body: JSON.stringify({
          volunteer_uid: currentUser.uid,
          need_id: needId,
        }),
      });

      // ── 409: Team full / already assigned / duplicate interest ──────
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));

        if (body.detail === 'Interest already sent.') {
          // Idempotent — volunteer already expressed interest, treat as success.
          setInterestedMissions((prev) => ({ ...prev, [interestKey]: true }));
          if (body.updated_need && onSuccess) onSuccess(needId, body.updated_need);
        } else if (body.detail?.startsWith('Team full')) {
          // Team is at max capacity
          toast.error('🚨 Team full! This mission has enough volunteers.', {
            duration: 4000,
            style: {
              background: '#18181B',
              color: '#FAFAFA',
              border: '1px solid rgba(239,68,68,0.3)',
            },
          });
        } else {
          // Generic race-loss / already claimed
          toast.error('🚨 Too late! Another volunteer just claimed this mission.', {
            duration: 4000,
            style: {
              background: '#18181B',
              color: '#FAFAFA',
              border: '1px solid rgba(239,68,68,0.3)',
            },
          });
        }

        // Always re-fetch so UI reflects true DB state.
        if (refetchAll) refetchAll();
        return;
      }

      // ── Any other non-2xx status ────────────────────────────────────
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // ── Success (201) ───────────────────────────────────────────────
      let updatedNeed = null;
      try {
        const body = await res.json();
        updatedNeed = body.updated_need ?? null;
      } catch {
        // Non-JSON body — silently ignore; optimistic flag still flips.
      }

      setInterestedMissions((prev) => ({ ...prev, [interestKey]: true }));
      setToast({ type: 'success', message: "You're on your way!" });

      // Forward the server-confirmed document to the caller so it can replace
      // the stale local copy and prevent rubberband overwrites on next re-fetch.
      if (onSuccess) onSuccess(needId, updatedNeed);

      // Re-fetch to guarantee UI matches DB.
      if (refetchAll) refetchAll();
    } catch (err) {
      console.error('[useInterest] Failed to record action:', err);
      toast.error('Could not send update. Try again.', {
        duration: 3000,
        style: {
          background: '#18181B',
          color: '#FAFAFA',
          border: '1px solid rgba(239,68,68,0.3)',
        },
      });

      // Re-fetch even on error so the UI never shows stale state.
      if (refetchAll) refetchAll();
    } finally {
      setInterestLoading((prev) => ({ ...prev, [needId]: false }));
    }
  };

  const clearInterest = (needId) => {
    const interestKey = `${currentUser?.uid}_${needId}`;
    setInterestedMissions((prev) => {
      const next = { ...prev };
      delete next[interestKey];
      return next;
    });
  };

  return { interestLoading, interestedMissions, handleInterest, clearInterest, setInterestedMissions };
}
