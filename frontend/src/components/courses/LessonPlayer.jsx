import Button from '../ui/Button';

export default function LessonPlayer({ lesson, onComplete, isCompleted }) {
  return (
    <div>
      {/* Video Player */}
      {lesson.video_url ? (
        <div style={{
          width: '100%', aspectRatio: '16/9', background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <video
            src={lesson.video_url}
            controls
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            id="lesson-video"
          />
        </div>
      ) : (
        <div style={{
          width: '100%', aspectRatio: '16/9', background: 'var(--gradient-card)',
          borderRadius: 'var(--radius-lg)', marginBottom: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '4rem',
        }}>
          🎬
        </div>
      )}

      {/* Lesson Info */}
      <div className="glass-card-static" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '8px' }}>{lesson.title}</h2>
        {lesson.description && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{lesson.description}</p>
        )}
        {lesson.duration_minutes && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ⏱ {lesson.duration_minutes} minutes
          </span>
        )}
      </div>

      {/* Lesson Content */}
      {lesson.content_text && (
        <div className="glass-card-static" style={{ padding: '24px', marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '12px' }}>Lesson Content</h4>
          <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {lesson.content_text}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {!isCompleted ? (
          <Button variant="primary" onClick={onComplete} id="complete-lesson-btn">
            ✓ Mark as Complete
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            ✓ Completed
          </Button>
        )}
      </div>
    </div>
  );
}
