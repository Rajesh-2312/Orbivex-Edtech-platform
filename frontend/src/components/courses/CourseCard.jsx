import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Badge from '../ui/Badge';
import {
  HiOutlineBookOpen, HiOutlineCommandLine, HiOutlineGlobeAlt,
  HiOutlineChartBarSquare, HiOutlineSwatch, HiOutlineBriefcase,
  HiOutlineArrowRight, HiOutlineSparkles,
} from 'react-icons/hi2';

/* Category → SVG icon + accent colour (no emojis) */
const categoryMeta = {
  Programming:    { Icon: HiOutlineCommandLine,    color: '#f97316' },
  'Web Dev':      { Icon: HiOutlineGlobeAlt,        color: '#22d3ee' },
  'Data Science': { Icon: HiOutlineChartBarSquare,  color: '#a78bfa' },
  Design:         { Icon: HiOutlineSwatch,          color: '#fb7185' },
  Business:       { Icon: HiOutlineBriefcase,       color: '#34d399' },
  default:        { Icon: HiOutlineBookOpen,        color: '#fbbf24' },
};

const difficultyVariant = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

export default function CourseCard({ course, index = 0 }) {
  const navigate = useNavigate();
  const { Icon, color } = categoryMeta[course.category] || categoryMeta.default;
  const lessonCount = course.lessons?.length || 0;

  return (
    <motion.div
      className="glass-card course-card"
      onClick={() => navigate(`/courses/${course.id}`)}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      style={{ '--cat-color': color }}
    >
      <div className="course-thumbnail">
        <div className="course-thumb-orb" />
        <div className="course-thumb-icon">
          <Icon size={30} style={{ color }} aria-hidden="true" />
        </div>
        {course.category && <span className="course-cat-chip">{course.category}</span>}
        {course.is_ai_generated && (
          <span className="course-ai-chip"><HiOutlineSparkles size={11} /> AI</span>
        )}
      </div>

      <div className="course-body">
        <h4 className="course-title">{course.title}</h4>
        <p className="course-desc">{course.description || 'No description available'}</p>

        <div className="course-meta">
          <Badge variant={difficultyVariant[course.difficulty] || 'primary'}>
            {course.difficulty || 'beginner'}
          </Badge>
          <div className="course-meta-lessons">
            <HiOutlineBookOpen size={14} />
            <span>{lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}</span>
          </div>
        </div>

        <div className="course-card-cta">
          View course <HiOutlineArrowRight size={13} />
        </div>
      </div>
    </motion.div>
  );
}
