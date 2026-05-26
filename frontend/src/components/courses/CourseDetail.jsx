import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import { HiOutlinePlay, HiOutlineCheckCircle } from 'react-icons/hi2';

export default function CourseDetail({ course, lessons, progress, onEnroll, enrolled }) {
  const navigate = useNavigate();

  return (
    <div>
      {/* Course Header */}
      <div className="glass-card-static" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ marginBottom: '8px' }}>{course.title}</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '600px' }}>
              {course.description}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge variant={course.difficulty === 'beginner' ? 'success' : course.difficulty === 'intermediate' ? 'warning' : 'danger'}>
                {course.difficulty}
              </Badge>
              {course.category && <Badge variant="info">{course.category}</Badge>}
            </div>
          </div>
          {!enrolled ? (
            <Button variant="primary" size="lg" onClick={onEnroll} id="enroll-btn">
              Enroll Now
            </Button>
          ) : (
            <Badge variant="success" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>✓ Enrolled</Badge>
          )}
        </div>

        {enrolled && progress && (
          <div style={{ marginTop: '24px' }}>
            <ProgressBar value={progress.completed} max={progress.total} showLabel />
          </div>
        )}
      </div>

      {/* Lessons List */}
      <h3 style={{ marginBottom: '16px' }}>Lessons ({lessons?.length || 0})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {lessons?.map((lesson, i) => {
          const isCompleted = progress?.lessons?.find(l => l.id === lesson.id)?.completed;
          return (
            <div
              key={lesson.id}
              className="glass-card"
              onClick={() => enrolled && navigate(`/lessons/${lesson.id}`)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: enrolled ? 'pointer' : 'default',
                opacity: enrolled ? 1 : 0.6,
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                background: isCompleted ? 'var(--gradient-success)' : 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: 'white', fontSize: '0.85rem', fontWeight: 600,
              }}>
                {isCompleted ? <HiOutlineCheckCircle size={18} /> : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{lesson.title}</div>
                {lesson.duration_minutes && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {lesson.duration_minutes} min
                  </div>
                )}
              </div>
              {enrolled && <HiOutlinePlay size={18} style={{ color: 'var(--primary-400)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
