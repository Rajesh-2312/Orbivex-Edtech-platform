import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import CourseList from '../components/courses/CourseList';
import useCourseStore from '../store/courseStore';
import {
  HiOutlineMagnifyingGlass, HiOutlineBookOpen, HiOutlineAcademicCap,
  HiOutlineSparkles, HiOutlineRectangleStack,
} from 'react-icons/hi2';

const ALL = 'All';

export default function CoursesPage() {
  const { courses, loading, fetchCourses } = useCourseStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);

  useEffect(() => {
    fetchCourses();
  }, []);

  /* Build category pills from live data */
  const categories = useMemo(() => {
    const set = new Set(courses.map((c) => c.category).filter(Boolean));
    return [ALL, ...Array.from(set)];
  }, [courses]);

  const filteredCourses = useMemo(() => courses.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.title?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q);
    const matchesCat = category === ALL || c.category === category;
    return matchesSearch && matchesCat;
  }), [courses, search, category]);

  const totalLessons = useMemo(
    () => courses.reduce((sum, c) => sum + (c.lessons?.length || 0), 0),
    [courses]
  );

  const stats = [
    { icon: HiOutlineRectangleStack, label: 'Courses', value: courses.length, color: 'var(--brand-500)' },
    { icon: HiOutlineBookOpen, label: 'Lessons', value: totalLessons, color: 'var(--accent-cyan)' },
    { icon: HiOutlineAcademicCap, label: 'Categories', value: Math.max(categories.length - 1, 0), color: 'var(--accent-violet)' },
  ];

  return (
    <PageTransition>
      {/* ── Hero header ── */}
      <motion.div
        className="page-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="page-hero-glow" />
        <div className="page-hero-main">
          <div className="page-hero-eyebrow">
            <HiOutlineSparkles size={14} /> Learning Catalog
          </div>
          <h1 className="page-hero-title">Explore Courses</h1>
          <p className="page-hero-sub">
            Browse the full catalog, filter by category, and enroll to start your learning orbit.
          </p>

          <div className="page-hero-stats">
            {stats.map((s) => (
              <div className="page-hero-stat" key={s.label}>
                <div className="page-hero-stat-icon" style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}>
                  <s.icon size={18} />
                </div>
                <div>
                  <div className="page-hero-stat-value">{s.value}</div>
                  <div className="page-hero-stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="page-hero-search">
          <HiOutlineMagnifyingGlass size={18} className="page-hero-search-icon" />
          <input
            type="text"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search courses"
          />
        </div>
      </motion.div>

      {/* ── Category filter pills ── */}
      {categories.length > 1 && (
        <div className="filter-pills" role="tablist" aria-label="Course categories">
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={category === cat}
              className={`filter-pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
              {cat !== ALL && (
                <span className="filter-pill-count">
                  {courses.filter((c) => c.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Result count ── */}
      {!loading && (
        <div className="courses-result-count">
          {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'}
          {category !== ALL && <> in <strong>{category}</strong></>}
          {search && <> matching “{search}”</>}
        </div>
      )}

      <CourseList courses={filteredCourses} loading={loading} />
    </PageTransition>
  );
}
