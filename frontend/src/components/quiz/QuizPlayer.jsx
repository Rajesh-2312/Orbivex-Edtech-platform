import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';

export default function QuizPlayer({ quiz, onSubmit }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const questions = quiz?.questions_json || [];
  const total = questions.length;
  const question = questions[currentQ];

  const selectAnswer = (optionIndex) => {
    setAnswers({ ...answers, [currentQ]: optionIndex });
  };

  const handleSubmit = () => {
    // Convert to correct_answer format
    const formattedAnswers = questions.map((_, i) => {
      const selectedIdx = answers[i];
      if (selectedIdx === undefined) return null;
      return String.fromCharCode(65 + selectedIdx); // 0→A, 1→B, etc.
    });
    onSubmit(formattedAnswers);
  };

  if (!question) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <h3 className="empty-state-title">No quiz available</h3>
        <p className="empty-state-text">This lesson doesn't have a quiz yet.</p>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      {/* Progress */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
            Question {currentQ + 1} of {total}
          </span>
          <span className="text-caption" style={{ color: 'var(--primary-400)' }}>
            {Object.keys(answers).length}/{total} answered
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${((currentQ + 1) / total) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <motion.div
        key={currentQ}
        className="quiz-question"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="quiz-question-text">{question.question}</div>
        <div className="quiz-options">
          {question.options?.map((option, i) => (
            <div
              key={i}
              className={`quiz-option ${answers[currentQ] === i ? 'selected' : ''}`}
              onClick={() => selectAnswer(i)}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                border: answers[currentQ] === i ? '2px solid var(--primary-500)' : '2px solid var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 600, flexShrink: 0,
                background: answers[currentQ] === i ? 'var(--primary-500)' : 'transparent',
                color: answers[currentQ] === i ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
                {String.fromCharCode(65 + i)}
              </div>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{option}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
        <Button
          variant="ghost"
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
        >
          ← Previous
        </Button>

        {currentQ < total - 1 ? (
          <Button variant="primary" onClick={() => setCurrentQ(currentQ + 1)}>
            Next →
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < total}
            id="submit-quiz-btn"
          >
            Submit Quiz
          </Button>
        )}
      </div>
    </div>
  );
}
