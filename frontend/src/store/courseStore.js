import { create } from 'zustand';
import api from '../lib/api';

const useCourseStore = create((set) => ({
  courses: [],
  currentCourse: null,
  lessons: [],
  loading: false,
  error: null,

  fetchCourses: async (params = {}) => {
    set({ loading: true });
    try {
      const res = await api.get('/courses', { params });
      set({ courses: res.data.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchCourse: async (id) => {
    set({ loading: true });
    try {
      const res = await api.get(`/api/courses/${id}`);
      set({ currentCourse: res.data.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchLessons: async (courseId) => {
    try {
      const res = await api.get(`/api/lessons/course/${courseId}`);
      set({ lessons: res.data.data });
    } catch (err) {
      set({ error: err.message });
    }
  },

  enrollInCourse: async (courseId) => {
    try {
      await api.post('/courses/enroll', { course_id: courseId });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || err.message });
      return false;
    }
  },

  clearCurrent: () => set({ currentCourse: null, lessons: [] }),
}));

export default useCourseStore;
