import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AssistantPanel from '../assistant/AssistantPanel';
import AssistantToggleButton from '../assistant/AssistantToggleButton';
import useUiStore from '../../store/uiStore';

export default function Layout() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const examMode = useUiStore((s) => s.examMode);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
      {/*
        Platform-wide assistant — available on every protected page except during
        a proctored attempt. An AI chat that will answer the question on screen is
        a cheating vector, so it is removed outright rather than merely hidden
        behind a warning.
      */}
      {!examMode && (
        <>
          <AssistantToggleButton />
          <AssistantPanel />
        </>
      )}
    </div>
  );
}
