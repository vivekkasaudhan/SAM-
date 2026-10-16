'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Droplet,
  Map,
  LayoutDashboard,
  Bell,
  Sun,
  Moon,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  User,
  LogOut,
  Radio,
  Menu,
  X,
  Compass,
  Database,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { authService } from '@/services/api';

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isWsConnected?: boolean;
}

export function Header({ activeTab, onTabChange, isWsConnected = true }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeNav, setActiveNav] = useState<'dashboard' | 'map'>('dashboard');

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (target: 'dashboard' | 'map') => {
    setActiveNav(target);
    setMobileMenuOpen(false);
    if (target === 'dashboard') {
      const el = document.getElementById('dashboard-overview');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      onTabChange?.('dashboard');
    } else if (target === 'map') {
      const el = document.getElementById('interactive-map');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
      onTabChange?.('map');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setShowProfileMenu(false);
    window.location.href = '/admin/login';
  };

  return (
    <header className="sticky top-0 z-50 w-full glass-header backdrop-blur-xl transition-all">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={() => handleNavClick('dashboard')}
            className="group flex items-center gap-3 focus:outline-none"
          >
            <div className="relative p-2 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-sky-400 text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-all">
              <Droplet className="h-5 w-5 fill-current" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white ring-2 ring-cyan-500 shadow-xs" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  SAM
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20">
                  Enterprise
                </span>
              </div>
              <div className="text-[10px] font-medium text-muted-foreground hidden sm:block tracking-wide">
                Environmental Intelligence Platform
              </div>
            </div>
          </Link>
        </div>

        {/* Compact Center Navigation: Dashboard & Map Only */}
        <nav className="hidden md:flex items-center p-1 rounded-xl bg-muted/50 border border-border/70 shadow-xs">
          <button
            onClick={() => handleNavClick('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
              activeNav === 'dashboard'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <LayoutDashboard className={`h-3.5 w-3.5 ${activeNav === 'dashboard' ? 'text-cyan-600 dark:text-cyan-400' : ''}`} />
            <span>Dashboard</span>
            {activeNav === 'dashboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-cyan-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => handleNavClick('map')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
              activeNav === 'map'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <Map className={`h-3.5 w-3.5 ${activeNav === 'map' ? 'text-cyan-600 dark:text-cyan-400' : ''}`} />
            <span>Interactive Map</span>
            {activeNav === 'map' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-cyan-500 rounded-full" />
            )}
          </button>
        </nav>

        {/* Right Action Section */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Live Telemetry Pill */}
          <div
            className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
              isWsConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-muted text-muted-foreground border-border'
            }`}
            title={isWsConnected ? 'Connected to live sensor network' : 'Connecting to sensor gateway...'}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isWsConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground'
                }`}
              />
            </span>
            <span className="tracking-tight">{isWsConnected ? 'Telemetry Live' : 'Connecting...'}</span>
          </div>

          {/* Notifications Dropdown Popover */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs focus:outline-none"
              title="Environmental Alerts & Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 ring-2 ring-card shadow-xs" />
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 rounded-2xl bg-card border border-border shadow-enterprise dark:shadow-enterprise-dark z-[1200] overflow-hidden text-xs animate-in fade-in slide-in-from-top-2">
                <div className="p-3.5 border-b bg-muted/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-cyan-500" />
                    <span className="font-bold text-foreground">Active Telemetry Alerts</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Online
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
                  <div className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold mb-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>NIT Jamshedpur Sensor ST001</span>
                    </div>
                    <div className="text-muted-foreground text-[11px] leading-relaxed">
                      Telemetry nominal. Groundwater stage stable at normal operating threshold.
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">Just now · Subarnarekha River Basin</div>
                  </div>

                  <div className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold mb-0.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Monsoon Catchment Advisory</span>
                    </div>
                    <div className="text-muted-foreground text-[11px] leading-relaxed">
                      Precipitation levels within seasonal boundaries across Jharkhand & Eastern India.
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">12m ago · Hydrological Risk Engine</div>
                  </div>

                  <div className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold mb-0.5">
                      <Compass className="h-3.5 w-3.5" />
                      <span>Lucknow Basin Connected</span>
                    </div>
                    <div className="text-muted-foreground text-[11px] leading-relaxed">
                      Uttar Pradesh regional monitoring node synchronized with central telemetry.
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">1h ago · Gomti River Catchment</div>
                  </div>
                </div>

                <div className="p-2.5 bg-muted/20 border-t text-center">
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold hover:underline"
                  >
                    Mark All Notifications as Read
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs focus:outline-none"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 rotate-0" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700 transition-transform duration-200 rotate-0" />
              )}
            </button>
          )}

          {/* Admin / Profile Menu Dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground transition-all shadow-xs focus:outline-none"
            >
              <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-500 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                {currentUser?.username ? currentUser.username[0].toUpperCase() : 'AS'}
              </div>
              <span className="text-xs font-semibold hidden sm:inline-block max-w-[90px] truncate">
                {currentUser?.username || 'Admin'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-card border border-border shadow-enterprise dark:shadow-enterprise-dark z-[1200] overflow-hidden text-xs py-1 animate-in fade-in slide-in-from-top-2">
                {currentUser ? (
                  <div className="px-3.5 py-2.5 border-b bg-muted/30">
                    <div className="font-bold text-foreground text-sm truncate">
                      {currentUser.full_name || currentUser.username}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate font-mono">
                      {currentUser.email || 'admin@aquasense.org'}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{currentUser.role || 'Super Admin'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 border-b bg-muted/30">
                    <div className="font-bold text-foreground">SAM Portal</div>
                    <div className="text-[11px] text-muted-foreground">Hydrological Monitoring</div>
                  </div>
                )}

                <div className="py-1">
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-muted/60 text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Admin Console</span>
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleNavClick('map');
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-muted/60 text-foreground transition-colors text-left"
                  >
                    <Map className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span>GIS Observation Grid</span>
                  </button>

                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-muted/60 text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-indigo-500" />
                      <span>API & Telemetry Docs</span>
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </div>

                <div className="border-t pt-1 mt-1">
                  {currentUser ? (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left font-medium"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <Link
                      href="/admin/login"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-cyan-600 dark:text-cyan-400 hover:bg-muted/60 transition-colors font-semibold"
                    >
                      <User className="h-4 w-4" />
                      <span>Admin Sign In</span>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground transition-all"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-card/95 backdrop-blur-xl px-4 py-3 space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-2 pb-2 border-b">
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs border ${
                activeNav === 'dashboard'
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                  : 'bg-muted/40 text-foreground border-border'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleNavClick('map')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs border ${
                activeNav === 'map'
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                  : 'bg-muted/40 text-foreground border-border'
              }`}
            >
              <Map className="h-4 w-4" />
              <span>GIS Map</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-muted-foreground">{isWsConnected ? 'Telemetry Active' : 'Connecting...'}</span>
            </div>
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold shadow-sm"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
