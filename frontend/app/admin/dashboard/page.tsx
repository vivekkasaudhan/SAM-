'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Droplet,
  Plus,
  RefreshCw,
  LogOut,
  MapPin,
  Cpu,
  Layers,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Radio,
  Clock,
  Waves,
  Sliders,
  Filter,
  Activity,
  Globe,
  Sun,
  Moon,
  AlertOctagon,
  LineChart,
  User,
  Users,
  UserPlus,
  UserX,
  Key,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { authService, wellService, geoService, isMainAdmin, isSubadmin, canManageWell } from '@/services/api';
import { AddWellModal } from '@/components/admin/AddWellModal';
import { EditWellModal } from '@/components/admin/EditWellModal';
import { DeleteWellDialog } from '@/components/admin/DeleteWellDialog';
import { WellDetailsModal } from '@/components/wells/WellDetailsModal';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, parseISO, format } from 'date-fns';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Active sub-navigation tab
  const [activeTab, setActiveTab] = useState<'wells' | 'sensors' | 'alerts' | 'subadmins'>('wells');

  // Wells list state
  const [wells, setWells] = useState<any[]>([]);
  const [loadingWells, setLoadingWells] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Subadmin Creator Filter (Main Admin only)
  const [selectedSubadmin, setSelectedSubadmin] = useState<string>('');
  const [subadminsList, setSubadminsList] = useState<any[]>([]);
  const [loadingSubadmins, setLoadingSubadmins] = useState(false);

  // Subadmin Management state (Main Admin only)
  const [isCreateSubadminOpen, setIsCreateSubadminOpen] = useState(false);
  const [deletingSubadmin, setDeletingSubadmin] = useState<any | null>(null);
  const [isDeletingSubadmin, setIsDeletingSubadmin] = useState(false);
  const [subadminForm, setSubadminForm] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
  });
  const [subadminFormError, setSubadminFormError] = useState<string | null>(null);
  const [creatingSubadmin, setCreatingSubadmin] = useState(false);

  // Geographic Hierarchy Filter
  const [selectedCountry, setSelectedCountry] = useState<string>('India');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingWell, setEditingWell] = useState<any | null>(null);
  const [deletingWell, setDeletingWell] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailWellId, setDetailWellId] = useState<string | null>(null);

  // Notification message
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchWells = useCallback(async () => {
    setLoadingWells(true);
    try {
      const filters: any = {};
      if (selectedCountry) filters.country = selectedCountry;
      if (selectedState) filters.state = selectedState;
      if (selectedDistrict) filters.district = selectedDistrict;
      if (selectedCity) filters.city = selectedCity;
      if (selectedSubadmin) filters.subadmin_id = selectedSubadmin;

      const data = await wellService.getWells(filters);
      setWells(data || []);
    } catch (err) {
      console.error('Failed to fetch registered wells', err);
    } finally {
      setLoadingWells(false);
    }
  }, [selectedCountry, selectedState, selectedDistrict, selectedCity, selectedSubadmin]);

  // Load geographic filter options
  useEffect(() => {
    geoService.getStates(selectedCountry).then(setAvailableStates).catch(() => {});
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedState) {
      geoService.getDistricts(selectedState, selectedCountry).then(setAvailableDistricts).catch(() => {});
    } else {
      setAvailableDistricts([]);
      setSelectedDistrict('');
    }
  }, [selectedState, selectedCountry]);

  useEffect(() => {
    if (selectedState || selectedDistrict) {
      geoService.getCities(selectedDistrict, selectedState, selectedCountry).then(setAvailableCities).catch(() => {});
    } else {
      setAvailableCities([]);
      setSelectedCity('');
    }
  }, [selectedDistrict, selectedState, selectedCountry]);

  const fetchSubadmins = useCallback(async () => {
    setLoadingSubadmins(true);
    try {
      const data = await authService.getSubadmins();
      setSubadminsList(data || []);
    } catch (err) {
      console.error('Failed to fetch subadmins', err);
    } finally {
      setLoadingSubadmins(false);
    }
  }, []);

  // Authentication check on load
  useEffect(() => {
    authService
      .me()
      .then((user) => {
        setCurrentUser(user);
        setAuthChecking(false);
        fetchWells();
        if (isMainAdmin(user)) {
          fetchSubadmins();
        }
      })
      .catch((err) => {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          authService.logout();
          router.push('/admin/login');
        } else {
          const cachedUser = authService.getCurrentUser();
          if (cachedUser) {
            setCurrentUser(cachedUser);
            setAuthChecking(false);
            fetchWells();
            if (isMainAdmin(cachedUser)) {
              fetchSubadmins();
            }
          } else if (!authService.isAuthenticated()) {
            router.push('/admin/login');
          } else {
            setAuthChecking(false);
          }
        }
      });
  }, [router, fetchWells, fetchSubadmins]);

  const handleLogout = async () => {
    await authService.logout();
    router.push('/admin/login');
  };

  const showBanner = (type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 5000);
  };

  const handleCreateSubadmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubadminFormError(null);
    if (!subadminForm.username.trim() || !subadminForm.email.trim() || !subadminForm.password.trim()) {
      setSubadminFormError('Username, email, and password are required.');
      return;
    }
    setCreatingSubadmin(true);
    try {
      await authService.createSubadmin(subadminForm);
      showBanner('success', `Subadmin account "${subadminForm.username}" provisioned successfully!`);
      setIsCreateSubadminOpen(false);
      setSubadminForm({ username: '', full_name: '', email: '', password: '' });
      fetchSubadmins();
    } catch (err: any) {
      setSubadminFormError(err?.response?.data?.detail || 'Failed to provision subadmin account.');
    } finally {
      setCreatingSubadmin(false);
    }
  };

  const handleConfirmDeleteSubadmin = async () => {
    if (!deletingSubadmin) return;
    setIsDeletingSubadmin(true);
    try {
      await authService.deleteSubadmin(deletingSubadmin.id);
      showBanner('success', `Subadmin "${deletingSubadmin.username}" deleted. Their wells have been reassigned.`);
      setDeletingSubadmin(null);
      fetchSubadmins();
      fetchWells();
    } catch (err: any) {
      showBanner('error', err?.response?.data?.detail || 'Failed to delete subadmin account.');
    } finally {
      setIsDeletingSubadmin(false);
    }
  };

  const handleWellCreated = (newWell: any) => {
    setWells((prev) => [newWell, ...prev]);
    showBanner('success', `Well "${newWell.name}" (${newWell.id}) registered successfully!`);
  };

  const handleWellUpdated = (updated: any) => {
    setWells((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    showBanner('success', `Well "${updated.name}" updated successfully.`);
  };

  const handleConfirmDelete = async () => {
    if (!deletingWell) return;
    setIsDeleting(true);
    try {
      await wellService.deleteWell(deletingWell.id);
      setWells((prev) => prev.filter((w) => w.id !== deletingWell.id));
      showBanner('success', `Well "${deletingWell.name}" (${deletingWell.id}) permanently deleted.`);
      setDeletingWell(null);
    } catch (err: any) {
      showBanner('error', err?.response?.data?.detail || 'Failed to delete well.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Real backend calculations
  const totalWells = wells.length;
  const liveSensorWells = wells.filter(
    (w) => w.is_active && w.latest_reading?.status === 'LIVE'
  ).length;
  const simulatedWells = wells.filter(
    (w) => w.latest_reading?.status === 'SIMULATED'
  ).length;
  const offlineWells = wells.filter((w) => !w.is_active).length;

  // Real threshold breaches requiring attention
  const attentionWells = useMemo(() => {
    return wells.filter((w) => {
      const r = w.latest_reading;
      if (!w.is_active) return true;
      if (!r) return false;
      const warn = w.warning_level_m ?? 7.5;
      const danger = w.danger_level_m ?? 8.5;
      const isWaterHigh = r.water_level_m >= warn;
      const isPhAbnormal = r.ph < 6.5 || r.ph > 8.5;
      const isTurbid = r.turbidity_ntu > 25;
      return isWaterHigh || isPhAbnormal || isTurbid;
    });
  }, [wells]);

  // Real active alerts derived from sensor telemetry
  const activeAlerts = useMemo(() => {
    const list: Array<{
      id: string;
      wellId: string;
      wellName: string;
      severity: 'CRITICAL' | 'WARNING' | 'NOTICE';
      message: string;
      parameter: string;
      value: string;
      timestamp?: string;
    }> = [];

    wells.forEach((w) => {
      const r = w.latest_reading;
      if (!w.is_active) {
        list.push({
          id: `${w.id}-offline`,
          wellId: w.id,
          wellName: w.name,
          severity: 'NOTICE',
          message: 'Station is deactivated or in maintenance mode',
          parameter: 'Status',
          value: 'OFFLINE',
          timestamp: w.created_at,
        });
        return;
      }

      if (!r) return;

      const danger = w.danger_level_m ?? 8.5;
      const warn = w.warning_level_m ?? 7.5;

      if (r.water_level_m >= danger) {
        list.push({
          id: `${w.id}-danger`,
          wellId: w.id,
          wellName: w.name,
          severity: 'CRITICAL',
          message: `Water column stage (${r.water_level_m.toFixed(2)}m) exceeds critical danger limit (${danger.toFixed(1)}m)`,
          parameter: 'Water Level',
          value: `${r.water_level_m.toFixed(2)} m`,
          timestamp: r.timestamp,
        });
      } else if (r.water_level_m >= warn) {
        list.push({
          id: `${w.id}-warn`,
          wellId: w.id,
          wellName: w.name,
          severity: 'WARNING',
          message: `Water column stage (${r.water_level_m.toFixed(2)}m) is in warning threshold zone (${warn.toFixed(1)}m)`,
          parameter: 'Water Level',
          value: `${r.water_level_m.toFixed(2)} m`,
          timestamp: r.timestamp,
        });
      }

      if (r.ph < 6.0 || r.ph > 9.0) {
        list.push({
          id: `${w.id}-ph`,
          wellId: w.id,
          wellName: w.name,
          severity: 'CRITICAL',
          message: `Acidic or alkaline threshold breach: pH reading is ${r.ph.toFixed(2)} (Safe range: 6.5 - 8.5)`,
          parameter: 'pH Level',
          value: r.ph.toFixed(2),
          timestamp: r.timestamp,
        });
      }
    });

    return list;
  }, [wells]);

  // Filtered wells based on search and status pills
  const filteredWells = useMemo(() => {
    return wells.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        (w.city && w.city.toLowerCase().includes(q)) ||
        (w.district && w.district.toLowerCase().includes(q)) ||
        (w.state && w.state.toLowerCase().includes(q)) ||
        (w.location_description && w.location_description.toLowerCase().includes(q)) ||
        (w.creator?.name && w.creator.name.toLowerCase().includes(q)) ||
        (w.creator?.username && w.creator.username.toLowerCase().includes(q)) ||
        (w.creator?.email && w.creator.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'LIVE') {
        return w.is_active && w.latest_reading?.status === 'LIVE';
      }
      if (statusFilter === 'SIMULATED') {
        return w.latest_reading?.status === 'SIMULATED';
      }
      if (statusFilter === 'ATTENTION') {
        return attentionWells.some((aw) => aw.id === w.id);
      }
      if (statusFilter === 'OFFLINE') {
        return !w.is_active;
      }

      return true;
    });
  }, [wells, searchQuery, statusFilter, attentionWells]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedCity('');
    setSelectedSubadmin('');
  };

  const formatRelativeTime = (ts?: string) => {
    if (!ts) return 'No readings yet';
    try {
      const d = parseISO(ts.replace('Z', ''));
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return ts;
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-500 animate-pulse border border-cyan-500/20">
            <Droplet className="h-8 w-8 fill-current" />
          </div>
          <div className="text-xs font-bold text-muted-foreground animate-pulse uppercase tracking-wider">
            Verifying Admin Authorization...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* ── Sticky Admin Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass-header backdrop-blur-xl border-b border-border/80 dark:border-navy-800 transition-all">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 via-cyan-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 hover:scale-105 transition-all"
              title="Return to Public GIS Map"
            >
              <Droplet className="h-5 w-5 fill-current" />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-foreground">
                  AquaSense
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Admin Console</span>
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <span>Enterprise Groundwater Station Management</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5 text-cyan-500" />
              <span>Live Public Map</span>
            </a>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs"
              title="Toggle Theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>

            {/* User Details */}
            <div className="hidden md:block text-right">
              <div className="text-xs font-bold text-foreground flex items-center justify-end gap-1.5">
                <span>{currentUser?.full_name || currentUser?.username}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                    isMainAdmin(currentUser)
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                  }`}
                >
                  {isMainAdmin(currentUser) ? 'Main Admin' : 'Subadmin'}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">{currentUser?.email}</div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all shadow-2xs active:scale-95"
              title="Sign out of Admin Console"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────── */}
      <main className="container flex-1 py-6 space-y-6">
        {/* Banner Alert */}
        {banner && (
          <div
            className={`flex items-center gap-2.5 p-4 rounded-2xl text-xs font-semibold border shadow-sm animate-in fade-in duration-200 ${
              banner.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{banner.message}</span>
          </div>
        )}

        {/* ── Admin Overview Statistics Cards (100% Real Backend Data) ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Total Registered */}
          <div className="p-4 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Total Wells</span>
              <Layers className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-2 text-foreground">
              {totalWells}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Registered in database</div>
          </div>

          {/* Live Sensors */}
          <div className="p-4 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Live Sensors</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] inline-block" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-2 text-emerald-600 dark:text-emerald-400">
              {liveSensorWells}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">IoT probes active</div>
          </div>

          {/* Simulated Nodes */}
          <div className="p-4 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Simulated Nodes</span>
              <Radio className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-2 text-amber-600 dark:text-amber-400">
              {simulatedWells}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">SyntheticEngine feeds</div>
          </div>

          {/* Attention Required */}
          <div className="p-4 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Needs Attention</span>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-2 text-rose-600 dark:text-rose-400">
              {attentionWells.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Threshold breaches</div>
          </div>

          {/* Deactivated / Offline */}
          <div className="col-span-2 md:col-span-1 p-4 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Offline / Disabled</span>
              <AlertOctagon className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-2 text-muted-foreground">
              {offlineWells}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Inactive stations</div>
          </div>
        </div>

        {/* ── Sub-Navigation Tabs ──────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setActiveTab('wells')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'wells'
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Waves className="h-3.5 w-3.5" />
              <span>Well Registry & Inventory ({filteredWells.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sensors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'sensors'
                  ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Sensors & Data Monitoring</span>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                activeTab === 'alerts'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Active Threshold Alerts ({activeAlerts.length})</span>
            </button>

            {/* Subadmins Management Tab (Main Admin Only) */}
            {isMainAdmin(currentUser) && (
              <button
                onClick={() => setActiveTab('subadmins')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'subadmins'
                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Subadmins ({subadminsList.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchWells}
              disabled={loadingWells}
              className="p-2 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw className={`h-4 w-4 ${loadingWells ? 'animate-spin text-cyan-500' : ''}`} />
            </button>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 via-cyan-600 to-teal-500 hover:from-brand-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Provision New Well</span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: WELL REGISTRY & MANAGEMENT ────────────────────── */}
        {activeTab === 'wells' && (
          <div className="space-y-4">
            {/* Search & Geographic Filter Command Deck */}
            <div className="p-4 sm:p-5 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search Input */}
                <div
                  className={`${
                    isMainAdmin(currentUser) ? 'md:col-span-3' : 'md:col-span-5'
                  } relative`}
                >
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, creator, city..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs font-medium"
                  />
                </div>

                {/* Subadmin Creator Filter (Main Admin Only) */}
                {isMainAdmin(currentUser) && (
                  <div className="md:col-span-2">
                    <select
                      value={selectedSubadmin}
                      onChange={(e) => setSelectedSubadmin(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs cursor-pointer"
                    >
                      <option value="">All Creators</option>
                      {subadminsList.map((sa) => (
                        <option key={sa.id} value={sa.id}>
                          {sa.full_name || sa.username}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* State Filter */}
                <div className="md:col-span-2">
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs cursor-pointer"
                  >
                    <option value="">All States in {selectedCountry}</option>
                    {availableStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District Filter */}
                <div className="md:col-span-2">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedState}
                    className="w-full px-3 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <option value="">{selectedState ? 'All Districts' : 'Select State First'}</option>
                    {availableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City Filter */}
                <div className="md:col-span-2">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    disabled={!selectedState}
                    className="w-full px-3 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <option value="">{selectedState ? 'All Cities' : 'Select State First'}</option>
                    {availableCities.map((ci) => (
                      <option key={ci} value={ci}>
                        {ci}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                <div className="md:col-span-1 flex items-center justify-end">
                  <button
                    onClick={handleResetFilters}
                    className="w-full py-2.5 px-3 rounded-xl border border-border/70 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all shadow-2xs"
                    title="Reset Search and Geographic Filters"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                  Status:
                </span>
                {[
                  { key: 'ALL', label: `All (${wells.length})` },
                  { key: 'LIVE', label: `Live Sensors (${liveSensorWells})` },
                  { key: 'SIMULATED', label: `Simulated (${simulatedWells})` },
                  { key: 'ATTENTION', label: `Needs Attention (${attentionWells.length})` },
                  { key: 'OFFLINE', label: `Offline (${offlineWells})` },
                ].map((pill) => (
                  <button
                    key={pill.key}
                    onClick={() => setStatusFilter(pill.key)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      statusFilter === pill.key
                        ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-xs'
                        : 'bg-muted/60 text-muted-foreground hover:text-foreground border border-border/60'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wells Data Table */}
            {loadingWells ? (
              <div className="p-8 rounded-3xl bg-card border border-border/80 text-center space-y-3 animate-pulse">
                <div className="text-xs font-semibold text-muted-foreground">
                  Synchronizing station inventory from database...
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ) : filteredWells.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-card/60 dark:bg-navy-900/60 border border-dashed border-border/80 space-y-3">
                <MapPin className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                <div className="text-sm font-bold text-foreground">No monitoring wells match current filters</div>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Try clearing search terms or selecting a broader geographic scope.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs border border-cyan-500/20"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/80 dark:border-navy-750 overflow-hidden bg-card/85 dark:bg-navy-900/85 backdrop-blur shadow-enterprise dark:shadow-enterprise-dark">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 dark:bg-navy-950/40 border-b border-border/60 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Station / Identity</th>
                        <th className="py-3.5 px-4">Created By / Owner</th>
                        <th className="py-3.5 px-4">Geographic Scope</th>
                        <th className="py-3.5 px-4">Data Source & Status</th>
                        <th className="py-3.5 px-4">Water Column Stage</th>
                        <th className="py-3.5 px-4">Hydrochemical Metrics</th>
                        <th className="py-3.5 px-4">Thresholds</th>
                        <th className="py-3.5 px-4">Freshness</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-foreground">
                      {filteredWells.map((well) => {
                        const reading = well.latest_reading;
                        const isLive = well.is_active && reading?.status === 'LIVE';
                        const isSim = reading?.status === 'SIMULATED';
                        const isOff = !well.is_active;

                        const warn = well.warning_level_m ?? 7.5;
                        const danger = well.danger_level_m ?? 8.5;
                        const isDanger = reading && reading.water_level_m >= danger;
                        const isWarn = reading && reading.water_level_m >= warn && !isDanger;

                        const locationParts = [well.city, well.district, well.state].filter(Boolean);
                        const canManage = canManageWell(currentUser, well);

                        return (
                          <tr
                            key={well.id}
                            className="hover:bg-muted/30 dark:hover:bg-navy-800/30 transition-colors"
                          >
                            {/* Identity */}
                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-xs text-foreground line-clamp-1">
                                {well.name}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.2 rounded bg-muted dark:bg-navy-950 text-foreground font-bold border border-border/60">
                                  {well.id}
                                </span>
                                {well.sensors && well.sensors.length > 0 && (
                                  <span className="text-teal-600 dark:text-teal-400 font-sans">
                                    • {well.sensors[0].model}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Created By / Owner */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                                <User className="h-3 w-3 text-cyan-500 shrink-0" />
                                <span className="truncate max-w-[130px]">
                                  {well.creator?.name || well.creator?.username || 'Main Admin'}
                                </span>
                                {currentUser &&
                                  well.created_by != null &&
                                  String(well.created_by) === String(currentUser.id) && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                      You
                                    </span>
                                  )}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                                {well.creator?.email || 'admin@aquasense.io'}
                              </div>
                            </td>

                            {/* Geographic Scope */}
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-xs text-foreground truncate max-w-[160px]">
                                {locationParts.length > 0 ? locationParts.join(', ') : 'India'}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {well.latitude.toFixed(4)}°N, {well.longitude.toFixed(4)}°E
                              </div>
                            </td>

                            {/* Status & Pipeline */}
                            <td className="py-3.5 px-4">
                              {isOff ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                                  OFFLINE
                                </span>
                              ) : isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] inline-block" />
                                  LIVE SENSOR
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <Radio className="h-3 w-3 text-amber-500" />
                                  SIMULATED
                                </span>
                              )}
                            </td>

                            {/* Water Stage */}
                            <td className="py-3.5 px-4">
                              {reading ? (
                                <div className="flex items-center gap-2">
                                  <div className="font-mono font-black text-sm text-foreground">
                                    {reading.water_level_m.toFixed(2)}m
                                  </div>
                                  {isDanger ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-rose-500/15 text-rose-600 border border-rose-500/30">
                                      Danger
                                    </span>
                                  ) : isWarn ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500/15 text-amber-600 border border-amber-500/30">
                                      Warning
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                      Normal
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">No reading</span>
                              )}
                            </td>

                            {/* Hydrochemical */}
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              {reading ? (
                                <div className="space-y-0.5 text-muted-foreground">
                                  <div>
                                    pH <strong className="text-teal-600 dark:text-teal-400">{reading.ph.toFixed(1)}</strong> · TDS <strong className="text-blue-600 dark:text-blue-400">{Math.round(reading.tds_ppm)}</strong>
                                  </div>
                                  <div className="text-[10px]">
                                    Turb {reading.turbidity_ntu.toFixed(1)} NTU · DO {reading.dissolved_oxygen_mg_l.toFixed(1)} mg/L
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">--</span>
                              )}
                            </td>

                            {/* Thresholds */}
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              <div className="text-amber-600 dark:text-amber-400 font-semibold">
                                W: {warn.toFixed(1)}m
                              </div>
                              <div className="text-rose-600 dark:text-rose-400 font-semibold">
                                D: {danger.toFixed(1)}m
                              </div>
                            </td>

                            {/* Freshness */}
                            <td className="py-3.5 px-4 text-[11px] text-muted-foreground">
                              {formatRelativeTime(reading?.timestamp)}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setDetailWellId(well.id)}
                                  className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-cyan-600 dark:text-cyan-400 transition-all shadow-2xs"
                                  title="View Comprehensive Telemetry"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                {canManage ? (
                                  <>
                                    <button
                                      onClick={() => setEditingWell(well)}
                                      className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs"
                                      title="Edit Well Attributes"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingWell({ id: well.id, name: well.name })}
                                      className="p-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-all shadow-2xs"
                                      title="Delete Monitoring Station"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span
                                    className="px-2 py-1 rounded-md text-[10px] font-bold bg-muted/80 text-muted-foreground border border-border/60"
                                    title="Created by another Subadmin (Read-only station)"
                                  >
                                    Read-only
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: SENSORS & DATA MONITORING ─────────────────────── */}
        {activeTab === 'sensors' && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <Cpu className="h-5 w-5 text-teal-500" />
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">
                    Telemetry Hardware Transceivers & Ingestion Status
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Audited hardware status, data source attribution, and ESP32/IoT ingestion pipeline
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wells.map((well) => {
                  const sensor = well.sensors && well.sensors[0];
                  const reading = well.latest_reading;
                  const isLive = well.is_active && reading?.status === 'LIVE';

                  return (
                    <div
                      key={well.id}
                      className="p-5 rounded-2xl bg-muted/20 dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-xs text-foreground line-clamp-1">
                            {well.name}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            Station ID: {well.id}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            isLive
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                        >
                          {isLive ? 'LIVE HARDWARE' : 'SYNTHETIC FEEDS'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs space-y-1.5 font-medium">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transceiver:</span>
                          <span className="font-bold text-foreground">
                            {sensor ? sensor.model : 'Unmetered (Synthetic)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sensor Probe:</span>
                          <span className="text-cyan-500 text-[11px] truncate max-w-[160px]">
                            {sensor ? sensor.sensor_type : 'Mathematical Model'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data Pipeline:</span>
                          <span className="font-mono text-[10px]">
                            {isLive ? 'MQTT / Ingest API' : 'SyntheticEngine-v1'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Telemetry:</span>
                          <span className="font-mono text-[10px]">
                            {formatRelativeTime(reading?.timestamp)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setDetailWellId(well.id)}
                        className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-xs border border-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect Station Telemetry</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: ACTIVE THRESHOLD ALERTS ───────────────────────── */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">
                    Active Hydrological & Hydrochemical Alerts
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Real-time threshold breaches evaluated against well safety limits
                  </p>
                </div>
              </div>

              {activeAlerts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-muted/20 border border-dashed border-border text-xs text-muted-foreground space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <div className="font-bold text-foreground">All Monitoring Stations Within Normal Bounds</div>
                  <p>No active flood, drought, or chemical threshold violations recorded.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                          : alert.severity === 'WARNING'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                          : 'bg-muted/40 border-border text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {alert.severity === 'CRITICAL' ? (
                          <AlertOctagon className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        ) : alert.severity === 'WARNING' ? (
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Activity className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <div className="font-bold text-foreground flex items-center gap-2">
                            <span>{alert.wellName}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({alert.wellId})
                            </span>
                          </div>
                          <div>{alert.message}</div>
                          {alert.timestamp && (
                            <div className="text-[10px] opacity-75 font-mono">
                              Timestamp: {alert.timestamp}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => setDetailWellId(alert.wellId)}
                          className="px-3 py-1.5 rounded-xl bg-card border border-border/80 hover:bg-muted font-bold text-xs text-foreground shadow-2xs transition-all flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5 text-cyan-500" />
                          <span>Inspect Well</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: SUBADMIN MANAGEMENT (MAIN ADMIN ONLY) ─────────── */}
        {activeTab === 'subadmins' && isMainAdmin(currentUser) && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground">
                      Subadmin Accounts & Regional Access Control
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Provision, monitor, and manage regional station administrators. Subadmins can create and edit their own wells, while viewing all other stations in read-only mode.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchSubadmins}
                    disabled={loadingSubadmins}
                    className="p-2 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                    title="Refresh Subadmin Accounts"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingSubadmins ? 'animate-spin text-purple-500' : ''}`} />
                  </button>

                  <button
                    onClick={() => {
                      setSubadminFormError(null);
                      setSubadminForm({ username: '', full_name: '', email: '', password: '' });
                      setIsCreateSubadminOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all active:scale-95"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Provision Subadmin</span>
                  </button>
                </div>
              </div>

              {loadingSubadmins ? (
                <div className="p-8 text-center space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Fetching registered Subadmins...
                  </div>
                  <div className="space-y-2 max-w-lg mx-auto">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : subadminsList.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-muted/20 border border-dashed border-border text-xs text-muted-foreground space-y-2">
                  <Users className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                  <div className="font-bold text-foreground">No Subadmin Accounts Registered</div>
                  <p>Click "Provision Subadmin" above to create your first delegated regional administrator.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/80 dark:border-navy-750 overflow-hidden bg-card/85 dark:bg-navy-900/85 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 dark:bg-navy-950/40 border-b border-border/60 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-4">Subadmin Identity</th>
                          <th className="py-3.5 px-4">Email Address</th>
                          <th className="py-3.5 px-4">Role & Status</th>
                          <th className="py-3.5 px-4">Registered Wells</th>
                          <th className="py-3.5 px-4">Created Date</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 text-foreground">
                        {subadminsList.map((sa) => (
                          <tr
                            key={sa.id}
                            className="hover:bg-muted/30 dark:hover:bg-navy-800/30 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-xs text-foreground">
                                {sa.full_name || sa.username}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                @{sa.username} • ID: {sa.id}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                              {sa.email}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                <Key className="h-3 w-3" />
                                <span>{sa.role || 'SUBADMIN'}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-xs text-cyan-600 dark:text-cyan-400">
                              {sa.wells_count ?? 0} stations
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                              {sa.created_at ? format(parseISO(sa.created_at.replace('Z', '')), 'MMM dd, yyyy') : '--'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => setDeletingSubadmin(sa)}
                                className="p-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-all shadow-2xs"
                                title="Delete Subadmin Account"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Modals & Dialogs ──────────────────────────────────────── */}
      <AddWellModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onWellCreated={handleWellCreated}
      />

      <EditWellModal
        well={editingWell}
        isOpen={!!editingWell}
        onClose={() => setEditingWell(null)}
        onWellUpdated={handleWellUpdated}
        onDeleteRequest={(wellToDelete) => {
          setEditingWell(null);
          setDeletingWell({ id: wellToDelete.id, name: wellToDelete.name });
        }}
      />

      <DeleteWellDialog
        isOpen={!!deletingWell}
        well={deletingWell}
        onClose={() => setDeletingWell(null)}
        onConfirm={handleConfirmDelete}
        deleting={isDeleting}
      />

      <WellDetailsModal
        wellId={detailWellId}
        isOpen={!!detailWellId}
        onClose={() => setDetailWellId(null)}
      />

      {/* ── Provision Subadmin Modal (Main Admin Only) ─────────────── */}
      {isCreateSubadminOpen && isMainAdmin(currentUser) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">Provision Subadmin</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Create delegated credentials for regional monitoring
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateSubadminOpen(false)}
                className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {subadminFormError && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold">
                {subadminFormError}
              </div>
            )}

            <form onSubmit={handleCreateSubadmin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1 uppercase tracking-wider">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={subadminForm.username}
                  onChange={(e) =>
                    setSubadminForm((prev) => ({ ...prev, username: e.target.value }))
                  }
                  placeholder="e.g. subadmin_north"
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1 uppercase tracking-wider">
                  Full Name / Region Identifier
                </label>
                <input
                  type="text"
                  value={subadminForm.full_name}
                  onChange={(e) =>
                    setSubadminForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  placeholder="e.g. Northern Basin Officer"
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1 uppercase tracking-wider">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={subadminForm.email}
                  onChange={(e) =>
                    setSubadminForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="subadmin@aquasense.io"
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1 uppercase tracking-wider">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={subadminForm.password}
                  onChange={(e) =>
                    setSubadminForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Enter strong password"
                  className="w-full px-3 py-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">Delegated Scope:</div>
                <p>
                  This Subadmin will be able to add new wells, edit/delete their own wells, and view telemetry for all other stations across the nation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateSubadminOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border/70 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubadmin}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {creatingSubadmin ? 'Provisioning...' : 'Provision Subadmin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Subadmin Dialog (Main Admin Only) ──────────────── */}
      {deletingSubadmin && isMainAdmin(currentUser) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60 dark:border-navy-800">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground">Delete Subadmin Account</h3>
                <p className="text-[11px] text-muted-foreground">
                  Permanent removal of delegated administrator
                </p>
              </div>
            </div>

            <div className="text-xs text-foreground space-y-2">
              <p>
                Are you sure you want to permanently delete Subadmin account{' '}
                <strong className="text-rose-600 dark:text-rose-400">
                  {deletingSubadmin.username}
                </strong>{' '}
                ({deletingSubadmin.email})?
              </p>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px]">
                <strong>Station Preserved:</strong> Any wells registered by this Subadmin (
                {deletingSubadmin.wells_count ?? 0} stations) will NOT be lost; they will be safely
                reassigned to the Main Admin.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSubadmin(null)}
                className="px-4 py-2 rounded-xl border border-border/70 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubadmin}
                disabled={isDeletingSubadmin}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeletingSubadmin ? 'Deleting...' : 'Delete Subadmin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
