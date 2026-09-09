import React from 'react';
import { PageId } from '../types/frontend';

interface SideNavBarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SideNavBar: React.FC<SideNavBarProps> = ({
  currentPage,
  onNavigate,
  isOpen = false,
  onClose,
}) => {
  const handleNavClick = (page: PageId) => {
    onNavigate(page);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden transition-opacity"
          aria-label="Close navigation overlay"
        />
      )}

      {/* Side Navigation Bar */}
      <nav
        className={`fixed left-0 top-16 h-[calc(100vh-64px)] w-64 md:w-60 bg-surface-container border-r border-outline-variant flex flex-col py-6 gap-y-4 z-40 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Studio / Command Center Header Block */}
        <div className="px-6 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#121212] border border-outline-variant no-radius overflow-hidden flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl">
                corporate_fare
              </span>
            </div>
            <div>
              <h2 className="font-label-caps text-label-caps text-on-surface font-bold">
                Command Center
              </h2>
              <p className="font-body-md text-[10px] text-on-surface-variant opacity-70">
                Legal Forensics v1.0
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="md:hidden text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Primary Navigation Links */}
        <div className="flex flex-col flex-1 gap-1 overflow-y-auto">
          <button
            onClick={() => handleNavClick('projects')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'projects'
                ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
                : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>Projects</span>
          </button>

          <button
            onClick={() => handleNavClick('dashboard')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'dashboard'
                ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
                : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">movie</span>
            <span>Scene Viewer</span>
          </button>

          <button
            onClick={() => handleNavClick('forensics')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'forensics'
                ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
                : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">animated_images</span>
            <span>Forensics</span>
          </button>

          <button
            onClick={() => handleNavClick('archive')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'archive'
                ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
                : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history_edu</span>
            <span>Archive</span>
          </button>

          <button
            onClick={() => handleNavClick('system-status')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'system-status'
                ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
                : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">sensors</span>
            <span>System Status</span>
          </button>

          <button
            onClick={() => handleNavClick('admin')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'admin'
                ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
                : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span>Admin Console</span>
          </button>
        </div>

        {/* Mid CTA / Utility Links */}
        <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant pt-4 px-3">
          <button
            onClick={() => handleNavClick('team')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-3 py-2.5 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'team'
                ? 'text-primary font-bold'
                : 'text-on-surface-variant opacity-70 hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            <span>Studio Team</span>
          </button>

          <button
            onClick={() => handleNavClick('profile')}
            className={`font-label-caps text-label-caps flex items-center gap-3 px-3 py-2.5 no-radius text-left w-full transition-all cursor-pointer min-h-[44px] ${
              currentPage === 'profile'
                ? 'text-primary font-bold'
                : 'text-on-surface-variant opacity-70 hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Executive Profile</span>
          </button>

          {/* Security Tier 05 Badge */}
          <div className="px-3 pt-3 flex items-center justify-between text-outline text-[11px] font-label-caps">
            <span>SECURITY TIER 05</span>
            <span className="inline-block w-2 h-2 bg-primary"></span>
          </div>
        </div>
      </nav>
    </>
  );
};
