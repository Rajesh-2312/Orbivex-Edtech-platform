import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import {
  HiOutlinePlay, HiOutlineCheckCircle, HiOutlineBookOpen, HiOutlineClock,
  HiOutlineLockClosed, HiOutlineCommandLine, HiOutlineGlobeAlt,
  HiOutlineChartBarSquare, HiOutlineSwatch, HiOutlineBriefcase, HiOutlineSignal,
} from 'react-icons/hi2';

const categoryMeta = {
  Programming:    { Icon: HiOutlineCommandLine,   color: '#f97316' },
  'Web Dev':      { Icon: HiOutlineGlobeAlt,       color: '#22d3ee' },
  'Data Science': { Icon: HiOutlineChartBarSquare, color: '#a78bfa' },
  Design:         { Icon: HiOutlineSwatch,         color: '#fb7185' },
  Business:       { Icon: HiOutlineBriefcase,      color: '#34d399' },
  default:        { Icon: HiOutlineBookOpen,       color: '#fbbf24' },
};

export default function CourseDetail({ course, lessons, progress, onEnroll, enrolled }) {
  const navigate = useNavigate();
  const { Icon, color } = categoryMeta[course.category] || categoryMeta.default;
  const lessonCount = lessons?.length || 0;
  const totalMinutes = (lessons || []).reduce((s, l) => s + (l.duration_minutes || 0), 0);

  const metaChips = [
    { icon: HiOutlineBookOpen, label: `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'}` },
    totalMinutes > 0 && { icon: HiOutlineClock, label: `${totalMinutes} min total` },
    { icon: HiOutlineSignal, label: course.difficulty || 'beginner' },
  ].filter(Boolean);

  return (
    <div>
      {/* ── Course hero header ── */}
      <motion.div
        className="course-detail-hero"
        style={{ '--cat-color': color }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="course-detail-hero-glow" />
        <div className="course-detail-hero-top">
          <div className="course-detail-icon">
            <Icon size={32} style={{ color }} aria-hidden="true" />
          </div>
          <div className="course-detail-head">
            <div className="course-detail-badges">
              <Badge variant={course.difficulty === 'beginner' ? 'success' : course.difficulty === 'intermediate' ? 'warning' : 'danger'}>
                {course.difficulty || 'beginner'}
              </Badge>
              {course.category && <Badge variant="info">{course.category}</Badge>}
            </div>
            <h1 className="course-detail-title">{course.title}</h1>
            <p className="course-detail-desc">{course.description || 'No description available.'}</p>

            <div className="course-detail-meta">
              {metaChips.map((m) => (
                <span className="course-detail-chip" key={m.label}>
                  <m.icon size={14} /> {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="course-detail-action">
            {!enrolled ? (
              <Button variant="primary" size="lg" onClick={onEnroll} id="enroll-btn">
                Enroll Now
              </Button>
            ) : (
              <span className="course-detail-enrolled">
                <HiOutlineCheckCircle size={16} /> Enrolled
              </span>
            )}
          </div>
        </div>

        {enrolled && progress && (
          <div className="course-detail-progress">
            <ProgressBar value={progress.completed} max={progress.total} showLabel />
          </div>
        )}
      </motion.div>

      {/* ── Lessons list ── */}
      <div className="course-lessons-head">
        <h3>Lessons</h3>
        <span className="course-lessons-count">{lessonCount}</span>
        {!enrolled && (
          <span className="course-lessons-lock">
            <HiOutlineLockClosed size={13} /> Enroll to unlock
          </span>
        )}
      </div>

      <div className="course-lessons-list">
        {lessons?.map((lesson, i) => {
          const isCompleted = progress?.lessons?.find((l) => l.id === lesson.id)?.completed;
          return (
            <motion.div
              key={lesson.id}
              className={`course-lesson-row ${enrolled ? 'unlocked' : 'locked'}`}
              onClick={() => enrolled && navigate(`/lessons/${lesson.id}`)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <div className={`course-lesson-num ${isCompleted ? 'done' : ''}`}>
                {isCompleted ? <HiOutlineCheckCircle size={18} /> : i + 1}
              </div>
              <div className="course-lesson-body">
                <div className="course-lesson-title">{lesson.title}</div>
                {lesson.duration_minutes && (
                  <div className="course-lesson-dur">
                    <HiOutlineClock size={12} /> {lesson.duration_minutes} min
                  </div>
                )}
              </div>
              {enrolled
                ? <HiOutlinePlay size={18} className="course-lesson-play" />
                : <HiOutlineLockClosed size={15} className="course-lesson-locked-ic" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
