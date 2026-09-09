import React, { useState } from 'react';
import { PageId } from '../types/frontend';
import { UserSession } from '../lib/authClient';

interface TopNavBarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenNewProject: () => void;
  selectedProjectName?: string;
  onSelectProject?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  user?: UserSession | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  currentPage,
  onNavigate,
  onOpenNewProject,
  selectedProjectName = 'Project: Neon Nights',
  onSelectProject,
  isMobileMenuOpen,
  onToggleMobileMenu,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-margin-desktop h-16 bg-surface border-b border-outline-variant">
      {/* Brand & Left Navigation */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={onToggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          className="md:hidden p-2 text-on-surface hover:text-primary transition-colors cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[24px]">
            {isMobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>

        <button
          onClick={() => onNavigate('projects')}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-left min-h-[44px]"
        >
          <span className="font-headline-md text-lg md:text-headline-md font-bold text-primary tracking-tighter">
            CineShield AI
          </span>
        </button>

        {/* Horizontal Navigation Links (Desktop only) */}
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
      <div className="flex-1 max-w-md mx-2 md:mx-6 hidden md:block">
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
              className="w-full bg-surface-container-high border-b border-outline-variant focus:border-primary focus:ring-0 text-on-surface font-body-md pl-10 pr-4 py-1.5 no-radius placeholder:text-on-surface-variant/50 transition-colors text-xs"
              placeholder="Search projects, slates, or forensic IDs..."
              type="text"
            />
          </div>
        )}
      </div>

      {/* Trailing Actions, Buttons & Executive Identity */}
      <div className="flex items-center gap-2 md:gap-4 sm:gap-6">
        <div className="flex items-center gap-1 md:gap-3 text-on-surface-variant">
          <button
            onClick={() => onNavigate('system-status')}
            title="System Status"
            className="hover:bg-surface-variant transition-colors p-2 no-radius cursor-pointer active:opacity-80 min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button
            onClick={() => onNavigate('profile')}
            title="Settings"
            className="hover:bg-surface-variant transition-colors p-2 no-radius cursor-pointer active:opacity-80 min-w-[40px] min-h-[40px] flex items-center justify-center hidden sm:flex"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>

        <button
          onClick={onOpenNewProject}
          className="bg-primary-container text-on-primary-container font-label-caps text-label-caps px-3 sm:px-6 py-2 no-radius hover:bg-primary transition-colors border border-transparent cursor-pointer font-bold whitespace-nowrap min-h-[40px] flex items-center text-xs"
        >
          <span className="material-symbols-outlined text-sm mr-1 sm:hidden">add</span>
          <span>New Project</span>
        </button>

        {/* User Identity and Session Controls */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              title={`${user.name} (${user.clearance})`}
              className="flex items-center gap-2 p-1 bg-surface-container-high border border-outline-variant hover:border-primary transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs">
                {user.name.charAt(0)}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-tight pr-1">
                <span className="text-xs text-on-surface font-medium truncate max-w-[110px]">{user.name}</span>
                <span className="text-[9px] text-primary font-mono">{user.clearance}</span>
              </div>
              <span className="material-symbols-outlined text-xs text-on-surface-variant">
                {userDropdownOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* User Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-outline-variant shadow-2xl z-50 py-1 no-radius">
                <div className="px-4 py-3 border-b border-outline-variant">
                  <p className="text-xs font-bold text-on-surface truncate">{user.name}</p>
                  <p className="text-[10px] text-on-surface-variant truncate">{user.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 bg-primary/20 text-primary font-mono font-bold">
                      {user.clearance}
                    </span>
                    <span className="text-[9px] text-outline font-label-caps uppercase">{user.role}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onNavigate('profile');
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-primary">settings</span>
                  <span>Account &amp; Settings</span>
                </button>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    if (onOpenAuth) onOpenAuth();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-surface-container-high flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-primary">swap_horiz</span>
                  <span>Switch Counsel / Identity</span>
                </button>

                <div className="border-t border-outline-variant my-1" />

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-error hover:bg-error-container/20 flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  <span>Sign Out / Lock Console</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 bg-primary text-on-primary font-label-caps text-xs font-bold hover:bg-primary-container transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">login</span>
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
