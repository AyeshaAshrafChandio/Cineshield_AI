import React from 'react';
import { PageId } from '../types/frontend';

interface TopNavBarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenNewProject: () => void;
  selectedProjectName?: string;
  onSelectProject?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  currentPage,
  onNavigate,
  onOpenNewProject,
  selectedProjectName = 'Project: Neon Nights',
  onSelectProject,
}) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-desktop h-16 bg-surface border-b border-outline-variant">
      {/* Brand & Left Navigation */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onNavigate('projects')}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-left"
        >
          <span className="font-headline-md text-headline-md font-bold text-primary tracking-tighter">
            CineShield AI
          </span>
        </button>

        {/* Horizontal Navigation Links as present in Studio Dashboard view */}
        <div className="hidden lg:flex items-center gap-6 ml-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`font-label-caps text-label-caps transition-colors cursor-pointer pb-1 ${
              currentPage === 'dashboard'
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('projects')}
            className={`font-label-caps text-label-caps transition-colors cursor-pointer pb-1 ${
              currentPage === 'projects'
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => onNavigate('forensics')}
            className={`font-label-caps text-label-caps transition-colors cursor-pointer pb-1 ${
              currentPage === 'forensics'
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Forensics
          </button>
          <button
            onClick={() => onNavigate('archive')}
            className={`font-label-caps text-label-caps transition-colors cursor-pointer pb-1 ${
              currentPage === 'archive'
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Archive
          </button>
        </div>
      </div>

      {/* Project Selector or Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden sm:block">
        {currentPage === 'dashboard' ? (
          <div
            onClick={onSelectProject}
            className="bg-surface-container-high border border-outline-variant px-3 py-1.5 flex items-center justify-between cursor-pointer max-w-xs"
          >
            <span className="font-label-caps text-label-caps text-on-surface-variant truncate">
              {selectedProjectName}
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">
              arrow_drop_down
            </span>
          </div>
        ) : (
          <div className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-sm">
              search
            </span>
            <input
              className="w-full bg-surface-container-high border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface font-body-md pl-10 pr-4 py-1.5 no-radius placeholder:text-on-surface-variant/50 transition-colors"
              placeholder="Search projects, slates, or forensic IDs..."
              type="text"
            />
          </div>
        )}
      </div>

      {/* Trailing Actions, Buttons & Executive Avatar */}
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <button
            onClick={() => onNavigate('system-status')}
            title="System Status"
            className="hover:bg-surface-variant transition-colors p-2 no-radius cursor-pointer active:opacity-80"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button
            onClick={() => onNavigate('profile')}
            title="Settings"
            className="hover:bg-surface-variant transition-colors p-2 no-radius cursor-pointer active:opacity-80"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>

        <button
          onClick={onOpenNewProject}
          className="bg-primary-container text-on-primary-container font-label-caps text-label-caps px-4 sm:px-6 py-2 no-radius hover:bg-primary transition-colors border border-transparent cursor-pointer font-bold"
        >
          New Project
        </button>

        {/* Executive User Avatar */}
        <button
          onClick={() => onNavigate('profile')}
          title="Julian Vane - Chief Legal Officer"
          className="w-8 h-8 bg-surface-variant border border-outline-variant no-radius overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
        >
          <img
            alt="Studio Executive Avatar"
            className="w-full h-full object-cover rounded-none"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBXIKIuv_GuwRbnreu6J3Zj1fONV-DP9UZTqgz14z1nxzNsn3VCjEHp0mvWFwbJlYjbXtAd6wnixs9r8TaHmXQ5Mr5MfRs0vdh5u4UtNXZimyFJevrUzMv1u2omJYasK8G-ROZJE8qF8GworhfzgHcD0p3H7nQLIEDvp3Jqr8K-VyD-i1G7PxcfGZ6TmJPXgYq_aRKXgyOM1kHDNLTI1DlMF8jXOrJ8_QGBmRPDisMfaf9Dwo6wnLw"
          />
        </button>
      </div>
    </header>
  );
};
