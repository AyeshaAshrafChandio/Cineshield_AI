import React from 'react';
import { PageId } from '../types/frontend';

interface SideNavBarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const SideNavBar: React.FC<SideNavBarProps> = ({ currentPage, onNavigate }) => {
  return (
    <nav className="fixed left-0 top-16 h-[calc(100vh-64px)] w-60 bg-surface-container border-r border-outline-variant flex flex-col py-6 gap-y-4 z-40">
      {/* Studio / Command Center Header Block */}
      <div className="px-6 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#121212] border border-outline-variant no-radius overflow-hidden flex items-center justify-center">
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
      </div>

      {/* Primary Navigation Links */}
      <div className="flex flex-col flex-1 gap-1">
        <button
          onClick={() => onNavigate('projects')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer ${
            currentPage === 'projects'
              ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
              : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          <span>Projects</span>
        </button>

        <button
          onClick={() => onNavigate('dashboard')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer ${
            currentPage === 'dashboard'
              ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
              : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">movie</span>
          <span>Scene Viewer</span>
        </button>

        <button
          onClick={() => onNavigate('forensics')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer ${
            currentPage === 'forensics'
              ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
              : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">animated_images</span>
          <span>Forensics</span>
        </button>

        <button
          onClick={() => onNavigate('archive')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer ${
            currentPage === 'archive'
              ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
              : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history_edu</span>
          <span>Archive</span>
        </button>

        <button
          onClick={() => onNavigate('system-status')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer ${
            currentPage === 'system-status'
              ? 'bg-primary-container text-on-primary-container font-bold border-r-4 border-primary'
              : 'text-on-surface-variant opacity-70 hover:bg-surface-container-high hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">sensors</span>
          <span>System Status</span>
        </button>

        <button
          onClick={() => onNavigate('admin')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-6 py-3 no-radius text-left w-full transition-all cursor-pointer ${
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
          onClick={() => onNavigate('team')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-3 py-2 no-radius text-left w-full transition-all cursor-pointer ${
            currentPage === 'team'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant opacity-70 hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          <span>Studio Team</span>
        </button>

        <button
          onClick={() => onNavigate('profile')}
          className={`font-label-caps text-label-caps flex items-center gap-3 px-3 py-2 no-radius text-left w-full transition-all cursor-pointer ${
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
  );
};
