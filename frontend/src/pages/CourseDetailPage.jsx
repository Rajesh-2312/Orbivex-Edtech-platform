import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import CourseDetail from '../components/courses/CourseDetail';
import useCourseStore from '../store/courseStore';
import useUiStore from '../store/uiStore';
import api from '../lib/api';
import Skeleton from '../components/ui/Skeleton';

export default function CourseDetailPage() {
  const { id } = useParams();
  const { currentCourse, lessons, fetchCourse, fetchLessons } = useCourseStore();
  const addToast = useUiStore((s) => s.addToast);
  const [progress, setProgress] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourse();
  }, [id]);

  const loadCourse = async () => {
    setLoading(true);
    await fetchCourse(id);
    await fetchLessons(id);

    // Check enrollment
    try {
      const res = await api.get('/courses/my/enrolled');
      const isEnrolled = res.data.data?.some((e) => e.courses?.id === id);
      setEnrolled(isEnrolled);

      if (isEnrolled) {
        const progRes = await api.get(`/progress/course/${id}`);
        setProgress(progRes.data.data);
      }
    } catch {}
    setLoading(false);
  };

  const handleEnroll = async () => {
    try {
      await api.post('/courses/enroll', { course_id: id });
      setEnrolled(true);
      addToast('Successfully enrolled!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to enroll', 'error');
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <Skeleton height="200px" style={{ marginBottom: '24px' }} />
        <Skeleton height="40px" width="60%" style={{ marginBottom: '16px' }} />
        <Skeleton height="20px" style={{ marginBottom: '8px' }} />
        <Skeleton height="20px" style={{ marginBottom: '8px' }} />
      </PageTransition>
    );
  }

  if (!currentCourse) {
    return (
      <PageTransition>
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3 className="empty-state-title">Course not found</h3>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <CourseDetail
        course={currentCourse}
        lessons={lessons}
        progress={progress}
        enrolled={enrolled}
        onEnroll={handleEnroll}
      />
    </PageTransition>
  );
}
