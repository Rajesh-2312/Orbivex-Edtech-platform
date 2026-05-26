import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Badge from '../ui/Badge';
import { HiOutlineBookOpen, HiOutlineClock } from 'react-icons/hi2';

const iconMap = {
  Programming: '💻',
  'Web Dev': '🌐',
  'Data Science': '📊',
  Design: '🎨',
  Business: '💼',
  default: '📚',
};

const difficultyVariant = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

export default function CourseCard({ course, index = 0 }) {
  const navigate = useNavigate();
  const icon = iconMap[course.category] || iconMap.default;

  return (
    <motion.div
      className="glass-card course-card"
      onClick={() => navigate(`/courses/${course.id}`)}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, boxShadow: '0 0 40px rgba(99,102,241,0.15)' }}
    >
      <div className="course-thumbnail" style={{ background: `var(--gradient-card)` }}>
        <span style={{ fontSize: '3rem', position: 'relative', zIndex: 1 }}>{icon}</span>
      </div>
      <div className="course-body">
        <h4 className="course-title">{course.title}</h4>
        <p className="course-desc">{course.description || 'No description available'}</p>
        <div className="course-meta">
          <Badge variant={difficultyVariant[course.difficulty] || 'primary'}>
            {course.difficulty || 'beginner'}
          </Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <HiOutlineBookOpen size={14} />
            <span>{course.lessons?.length || 0} lessons</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
