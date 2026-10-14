import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import QuizPlayer from '../components/quiz/QuizPlayer';
import QuizResults from '../components/quiz/QuizResults';
import Skeleton from '../components/ui/Skeleton';
import useUiStore from '../store/uiStore';
import api from '../lib/api';

export default function QuizPage() {
  const { lessonId } = useParams();
  const addToast = useUiStore((s) => s.addToast);
  const [quiz, setQuiz] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuiz();
  }, [lessonId]);

  const loadQuiz = async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await api.get(`/quizzes/lesson/${lessonId}`);
      setQuiz(res.data.data);
    } catch {
      setQuiz(null);
    }
    setLoading(false);
  };

  const handleSubmit = async (answers) => {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await api.post('/quizzes/submit', {
        quiz_id: quiz.id,
        answers,
      });
      setResults(res.data.data);
      addToast(`Quiz submitted! Score: ${res.data.data.score}%`, res.data.data.score >= 70 ? 'success' : 'warning');
    } catch (err) {
      addToast('Failed to submit quiz', 'error');
    }
    setSubmitting(false);
  };

  const handleRetry = () => {
    setResults(null);
  };

  if (loading) {
    return (
      <PageTransition>
        <Skeleton height="40px" width="60%" style={{ marginBottom: '24px' }} />
        <Skeleton height="200px" style={{ marginBottom: '16px' }} />
        <Skeleton height="50px" style={{ marginBottom: '8px' }} />
        <Skeleton height="50px" style={{ marginBottom: '8px' }} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <h1 style={{ marginBottom: '24px', textAlign: 'center' }}>
        {results ? '📊 Quiz Results' : '📝 Quiz Time'}
      </h1>

      {results ? (
        <QuizResults results={results} onRetry={handleRetry} />
      ) : (
        <QuizPlayer quiz={quiz} onSubmit={handleSubmit} />
      )}
    </PageTransition>
  );
}
