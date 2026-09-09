import React, { useState, useEffect } from 'react';
import { PageId } from './types/frontend';
import { TopNavBar } from './components/TopNavBar';
import { SideNavBar } from './components/SideNavBar';
import { NewProjectModal } from './components/NewProjectModal';
import { AuthModal } from './components/AuthModal';
import { ActiveSlatesPage } from './pages/ActiveSlatesPage';
import { SceneViewerPage } from './pages/SceneViewerPage';
import { ForensicsPage } from './pages/ForensicsPage';
import { ArchivePage } from './pages/ArchivePage';
import { SystemStatusPage } from './pages/SystemStatusPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { TeamPage } from './pages/TeamPage';
import { getStoredUser, subscribeAuth, setStoredUser, UserSession, apiFetch } from './lib/authClient';

export default function App() {
  // Restore state across page refreshes
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    try {
      const saved = localStorage.getItem('cineshield_page');
      if (saved && ['projects', 'dashboard', 'forensics', 'archive', 'system-status', 'admin', 'profile', 'team'].includes(saved)) {
        return saved as PageId;
      }
    } catch {}
    return 'projects';
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('cineshield_project_id') || undefined;
    } catch {
      return undefined;
    }
  });

  const [selectedProjectTitle, setSelectedProjectTitle] = useState('Project: Neon Nights');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(getStoredUser());

  useEffect(() => {
    const unsubscribe = subscribeAuth((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const handleNavigate = (page: PageId, projectId?: string) => {
    setCurrentPage(page);
    try {
      localStorage.setItem('cineshield_page', page);
    } catch {}

    setIsMobileMenuOpen(false);
    if (projectId) {
      setSelectedProjectId(projectId);
      try {
        localStorage.setItem('cineshield_project_id', projectId);
      } catch {}
      setSelectedProjectTitle(`Project #${projectId.slice(0, 8)}`);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // network failure fallback
    }
    setStoredUser(null);
  };

  const handleProjectCreated = (projectId: string, scriptId: string, analysisId?: string) => {
    setSelectedProjectId(projectId);
    try {
      localStorage.setItem('cineshield_project_id', projectId);
    } catch {}
    setSelectedProjectTitle(`Project #${projectId.slice(0, 8)}`);
    setIsMobileMenuOpen(false);
    // Navigate directly to Scene Viewer dashboard to view newly ingested screenplay and analysis
    setCurrentPage('dashboard');
    try {
      localStorage.setItem('cineshield_page', 'dashboard');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#181309] text-[#ede1d1] selection:bg-[#f4b400] selection:text-[#654800] flex flex-col font-sans overflow-x-hidden">
      {/* Top Fixed Header */}
      <TopNavBar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        selectedProjectName={selectedProjectTitle}
        onSelectProject={() => handleNavigate('projects')}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        user={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Responsive Sidebar Navigation */}
      <SideNavBar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content View Switcher */}
      <div className="flex-1 flex flex-col w-full">
        {currentPage === 'projects' && (
          <ActiveSlatesPage
            onNavigate={handleNavigate}
            onOpenNewProject={() => setIsNewProjectOpen(true)}
          />
        )}

        {currentPage === 'dashboard' && (
          <SceneViewerPage
            projectId={selectedProjectId}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'forensics' && (
          <ForensicsPage
            projectId={selectedProjectId}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'archive' && (
          <ArchivePage
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'system-status' && (
          <SystemStatusPage
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'admin' && (
          <AdminPage
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'profile' && (
          <ProfilePage
            onNavigate={handleNavigate}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentPage === 'team' && (
          <TeamPage
            onNavigate={handleNavigate}
          />
        )}
      </div>

      {/* New Project / Screenplay Ingestion Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Authentication and Identity Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}
