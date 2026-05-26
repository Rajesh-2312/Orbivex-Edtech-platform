import { useState, useEffect } from 'react';
import PageTransition from '../components/layout/PageTransition';
import CourseList from '../components/courses/CourseList';
import Input from '../components/ui/Input';
import useCourseStore from '../store/courseStore';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';

export default function CoursesPage() {
  const { courses, loading, fetchCourses } = useCourseStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  const filteredCourses = courses.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageTransition>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Explore Courses</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Browse and enroll in available courses</p>
        </div>
        <div style={{ width: '300px' }}>
          <Input
            icon={HiOutlineMagnifyingGlass}
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="search-courses"
          />
        </div>
      </div>

      <CourseList courses={filteredCourses} loading={loading} />
    </PageTransition>
  );
}
