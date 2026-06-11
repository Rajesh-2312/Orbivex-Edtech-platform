import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import useAuthStore from './store/authStore';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import LessonPage from './pages/LessonPage';
import QuizPage from './pages/QuizPage';
import ProgressPage from './pages/ProgressPage';
import JobsPage from './pages/JobsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import TestsPage from './pages/TestsPage';
import TestPage from './pages/TestPage';
import TestResultPage from './pages/TestResultPage';
import CompanyPrepPage from './pages/CompanyPrepPage';
import CompanyPrepDetailPage from './pages/CompanyPrepDetailPage';
import CompanyPrepRoundPage from './pages/CompanyPrepRoundPage';
import TopicLearnPage from './pages/TopicLearnPage';
import TopicPracticePage from './pages/TopicPracticePage';
import CalendarPage from './pages/CalendarPage';
import NotificationsPage from './pages/NotificationsPage';
import Toast from './components/ui/Toast';
import LSRWPage from './pages/lsrw/LSRWPage';
import LSRWListeningPage from './pages/lsrw/LSRWListeningPage';
import LSRWSpeakingPage from './pages/lsrw/LSRWSpeakingPage';
import LSRWReadingPage from './pages/lsrw/LSRWReadingPage';
import LSRWWritingPage from './pages/lsrw/LSRWWritingPage';
import LSRWResultPage from './pages/lsrw/LSRWResultPage';
import TPODashboardPage from './pages/TPODashboardPage';
import PlacementDrivesPage from './pages/PlacementDrivesPage';
import PlacementAnalyticsPage from './pages/PlacementAnalyticsPage';
import PlacementProfilePage from './pages/PlacementProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import SaasAdminPage from './pages/SaasAdminPage';
import CodingPracticePage from './pages/CodingPracticePage';
import ResumeBuilderPage from './pages/ResumeBuilderPage';
import SkillGapPage from './pages/SkillGapPage';
import PYQPage from './pages/PYQPage';

function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// TPO + admin can access placement management routes
function PlacementRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!['admin', 'tpo', 'teacher'].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AuthRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  // On cold start, if we have a stored session, refresh the profile and
  // re-attach the Realtime notifications channel.
  useEffect(() => {
    if (token && user) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Toast />
      <AnimatePresence mode="wait">
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth routes */}
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />

          {/* Self-service onboarding (no auth required) */}
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Founder SaaS admin portal (standalone, own auth check) */}
          <Route path="/saas-admin" element={<SaasAdminPage />} />

          {/* Protected routes (inside Layout) */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/lessons/:id" element={<LessonPage />} />
            <Route path="/quiz/:lessonId" element={<QuizPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/company-prep" element={<CompanyPrepPage />} />
            <Route path="/company-prep/:slug" element={<CompanyPrepDetailPage />} />
            <Route path="/company-prep/:slug/rounds/:index" element={<CompanyPrepRoundPage />} />
            <Route path="/company-prep/:slug/rounds/:index/topics/:topicIdx/learn" element={<TopicLearnPage />} />
            <Route path="/company-prep/:slug/rounds/:index/topics/:topicIdx/practice" element={<TopicPracticePage />} />
            <Route path="/tests" element={<TestsPage />} />
            <Route path="/tests/:id" element={<TestPage />} />
            <Route path="/tests/:id/result" element={<TestResultPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
            {/* Placement routes — TPO / admin / teacher */}
            <Route path="/placement" element={<PlacementRoute><TPODashboardPage /></PlacementRoute>} />
            <Route path="/placement/drives" element={<PlacementRoute><PlacementDrivesPage /></PlacementRoute>} />
            <Route path="/placement/analytics" element={<PlacementRoute><PlacementAnalyticsPage /></PlacementRoute>} />
            <Route path="/placement/profiles" element={<PlacementRoute><PlacementProfilePage /></PlacementRoute>} />
            {/* Student — own placement profile */}
            <Route path="/my-placement" element={<PlacementProfilePage />} />
            {/* LSRW Skills routes */}
            <Route path="/coding" element={<CodingPracticePage />} />
            <Route path="/resume" element={<ResumeBuilderPage />} />
            <Route path="/skill-gap" element={<SkillGapPage />} />
            <Route path="/pyq" element={<PYQPage />} />
            <Route path="/lsrw" element={<LSRWPage />} />
            <Route path="/lsrw/listening" element={<LSRWListeningPage />} />
            <Route path="/lsrw/speaking" element={<LSRWSpeakingPage />} />
            <Route path="/lsrw/reading" element={<LSRWReadingPage />} />
            <Route path="/lsrw/writing" element={<LSRWWritingPage />} />
            <Route path="/lsrw/result" element={<LSRWResultPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
