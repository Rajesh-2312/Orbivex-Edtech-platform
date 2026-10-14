import { useState } from 'react';
import { HiOutlineHandThumbUp, HiOutlineHandThumbDown, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import api from '../../lib/api';

/**
 * Thumbs up/down on an assistant answer, plus a soft low-confidence hint.
 *
 * The rating is the seed corpus for the Phase 6 fine-tune, so it posts to the
 * shared feedback endpoint (lesson tutor and platform assistant both write to
 * tutor_messages). Only rates real persisted messages — a temp/streaming id is
 * not yet in the DB.
 */
export default function FeedbackBar({ messageId, lowConfidence }) {
  const [value, setValue] = useState(0);
  const [busy, setBusy] = useState(false);

  const persisted = messageId && !/^(a-|stream-|tmp-|err-)/.test(String(messageId));

  const rate = async (v) => {
    if (!persisted || busy) return;
    const next = value === v ? 0 : v; // toggle off if same
    setBusy(true);
    setValue(next);
    try {
      await api.post(`/tutor/messages/${messageId}/feedback`, { value: next });
    } catch {
      setValue(value); // revert on failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
      {lowConfidence && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          font: '500 0.7rem/1.2 var(--font-body)', color: '#fbbf24',
        }}>
          <HiOutlineExclamationTriangle size={13} /> Double-check this
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button
          onClick={() => rate(1)} disabled={!persisted || busy} aria-label="Helpful"
          title={persisted ? 'Helpful' : 'Available once the answer is saved'}
          style={thumbStyle(value === 1, '#4ade80', persisted)}
        >
          <HiOutlineHandThumbUp size={14} />
        </button>
        <button
          onClick={() => rate(-1)} disabled={!persisted || busy} aria-label="Not helpful"
          title={persisted ? 'Not helpful' : 'Available once the answer is saved'}
          style={thumbStyle(value === -1, '#fca5a5', persisted)}
        >
          <HiOutlineHandThumbDown size={14} />
        </button>
      </div>
    </div>
  );
}

function thumbStyle(active, activeColor, enabled) {
  return {
    display: 'inline-flex', padding: 4, borderRadius: 6, cursor: enabled ? 'pointer' : 'default',
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: '1px solid ' + (active ? activeColor : 'rgba(255,255,255,0.1)'),
    color: active ? activeColor : 'var(--text-muted)',
    opacity: enabled ? 1 : 0.4,
  };
}
