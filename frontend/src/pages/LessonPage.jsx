import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import LessonPlayer from '../components/courses/LessonPlayer';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import TutorChat from '../components/tutor/TutorChat';
import TutorToggleButton from '../components/tutor/TutorToggleButton';
import useUiStore from '../store/uiStore';
import useTutorStore from '../store/tutorStore';
import api from '../lib/api';

export default function LessonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);
  const setTutorOpen = useTutorStore((s) => s.setOpen);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  // Reset tutor sidebar when navigating to a different lesson.
  useEffect(() => { setTutorOpen(false); }, [id, setTutorOpen]);

  useEffect(() => {
    loadLesson();
  }, [id]);

  const loadLesson = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/lessons/${id}`);
      setLesson(res.data.data);
    } catch {}
    setLoading(false);
  };

  const handleComplete = async () => {
    try {
      await api.post('/progress', { lesson_id: id });
      setIsCompleted(true);
      addToast('Lesson completed! 🎉', 'success');
    } catch (err) {
      addToast('Failed to mark as complete', 'error');
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <Skeleton height="400px" style={{ marginBottom: '24px' }} />
        <Skeleton height="32px" width="50%" style={{ marginBottom: '16px' }} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--primary-400)', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          ← Back to Course
        </button>
      </div>

      <LessonPlayer lesson={lesson} onComplete={handleComplete} isCompleted={isCompleted} />

      {/* Quiz Link */}
      {lesson?.quizzes?.length > 0 && (
        <div className="glass-card-static" style={{ padding: '24px', marginTop: '24px', textAlign: 'center' }}>
          <h4 style={{ marginBottom: '12px' }}>📝 Quiz Available</h4>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Test your knowledge on this lesson</p>
          <Button variant="primary" onClick={() => navigate(`/quiz/${id}`)}>
            Take Quiz
          </Button>
        </div>
      )}

      {/* AI Tutor — floating button + sliding chat sidebar */}
      <TutorToggleButton />
      <TutorChat lessonId={id} lessonTitle={lesson?.title} />
    </PageTransition>
  );
}
