import CourseCard from './CourseCard';
import { SkeletonCard } from '../ui/Skeleton';

export default function CourseList({ courses, loading }) {
  if (loading) {
    return (
      <div className="courses-grid">
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📚</div>
        <h3 className="empty-state-title">No courses found</h3>
        <p className="empty-state-text">Check back later for new courses or try a different search.</p>
      </div>
    );
  }

  return (
    <div className="courses-grid">
      {courses.map((course, i) => (
        <CourseCard key={course.id} course={course} index={i} />
      ))}
    </div>
  );
}
