import { motion } from 'framer-motion';
import Button from '../ui/Button';
import { HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi2';

export default function QuizResults({ results, onRetry }) {
  if (!results) return null;

  const { score, correct, total, results: details } = results;
  const isPassing = score >= 70;

  return (
    <div className="quiz-container">
      {/* Score Header */}
      <motion.div
        className="glass-card-static"
        style={{ padding: '40px', textAlign: 'center', marginBottom: '32px' }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '8px' }}>
          {isPassing ? '🎉' : '📚'}
        </div>
        <motion.div
          style={{
            font: '800 3rem/1 var(--font-display)',
            background: isPassing ? 'var(--gradient-success)' : 'var(--gradient-danger)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {score}%
        </motion.div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          {correct} out of {total} correct
        </div>
        <div style={{ color: isPassing ? 'var(--accent-emerald)' : 'var(--accent-rose)', marginTop: '8px', fontWeight: 600 }}>
          {isPassing ? 'Great job! You passed!' : 'Keep studying and try again!'}
        </div>
      </motion.div>

      {/* Detailed Results */}
      <h4 style={{ marginBottom: '16px' }}>Question Breakdown</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {details?.map((q, i) => (
          <motion.div
            key={i}
            className="glass-card-static"
            style={{ padding: '16px 20px' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              {q.is_correct ? (
                <HiOutlineCheckCircle size={22} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <HiOutlineXCircle size={22} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: '2px' }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: '6px' }}>{q.question}</div>
                <div style={{ fontSize: '0.85rem', color: q.is_correct ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  Your answer: {q.user_answer}
                </div>
                {!q.is_correct && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
                    Correct: {q.correct_answer}
                  </div>
                )}
                {q.explanation && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                    {q.explanation}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Button variant="primary" onClick={onRetry} style={{ width: '100%' }}>
        Try Again
      </Button>
    </div>
  );
}
