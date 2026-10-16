"use client";

import { useState, useEffect } from 'react';
import { useLocation, DEMO_LOCATIONS } from '@/hooks/useLocation';
import { useEnvironmentData } from '@/hooks/useEnvironmentData';
import { Header } from '@/components/layout/Header';
import { MapView } from '@/components/map/MapView';
import { GeoHierarchyFilter, GeoFilterState } from '@/components/map/GeoHierarchyFilter';
import { LocationSearch } from '@/components/dashboard/LocationSearch';
import { EnvironmentOverview } from '@/components/dashboard/EnvironmentOverview';
import { wellService } from '@/services/api';
import { WellCard } from '@/components/wells/WellCard';
import { WellDetailsModal } from '@/components/wells/WellDetailsModal';
import { WaterFlowPipe } from '@/components/visualization/WaterFlowPipe';
import { WeatherSection } from '@/components/sections/WeatherSection';
import { WaterSection } from '@/components/sections/WaterSection';
import { WaterQualitySection } from '@/components/sections/WaterQualitySection';
import { AirQualitySection } from '@/components/sections/AirQualitySection';
import { RiskSection } from '@/components/sections/RiskSection';
import { AnalyticsSection } from '@/components/sections/AnalyticsSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  RefreshCw,
  AlertCircle,
  LocateFixed,
  Radio,
  ShieldCheck,
  Compass,
  Layers,
  CloudSun,
  Waves,
  Droplets,
  Wind,
  AlertTriangle,
  LineChart,
  Activity,
  ArrowUpRight,
  Globe,
  Search,
  X,
} from 'lucide-react';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-56 rounded-2xl bg-muted/60" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-2xl bg-muted/60" />
      <Skeleton className="h-96 w-full rounded-2xl bg-muted/60" />
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (lat: number, lon: number, name: string) => void }) {
  return (
    <div className="p-8 sm:p-12 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/60 dark:bg-navy-900/60 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark text-center space-y-6 transition-all">
      <div className="inline-flex p-4 rounded-2xl bg-brand-500/10 text-brand-500 border border-brand-500/20 shadow-inner">
        <Compass className="h-10 w-10 text-cyan-500 animate-spin-slow" />
      </div>

      <div className="max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
          <Activity className="h-3 w-3 animate-pulse" /> Telemetry Hub Ready
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Select Any Location on the Interactive GIS Canvas
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Explore real-time hydrological stage, groundwater recharge trends, water quality index sensors, atmospheric metrics, and flood risk analysis across India.
        </p>
      </div>

      <div className="pt-2">
        <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Quick Demo Presets
        </div>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {DEMO_LOCATIONS.map((loc) => (
            <button
              key={loc.name}
              onClick={() => onSelect(loc.lat, loc.lon, loc.name)}
              className="px-3.5 py-1.5 rounded-full border border-border/80 dark:border-navy-750 bg-background/80 hover:bg-muted text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 text-foreground hover:scale-105 hover:border-cyan-500/50"
            >
              <LocateFixed className="h-3.5 w-3.5 text-cyan-500" />
              <span>{loc.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LocationHeader({
  location,
  data,
  secondsAgo,
  loading,
  isWsConnected,
  onRefetch,
}: {
  location: { lat: number; lon: number; display_name: string; city?: string; state?: string; country?: string };
  data: any;
  secondsAgo: number;
  loading: boolean;
  isWsConnected: boolean;
  onRefetch: () => void;
}) {
  const title = location.city
    ? `${location.city}${location.state ? `, ${location.state}` : ''}`
    : location.display_name.split(',').slice(0, 2).join(',');

  const nearestSt = data?.water_level?.nearest_station;
  const nearestDist = data?.water_level?.nearest_station_distance_km;
  const dataSourceStatus = data?.water_level?.data_source?.status || 'SIMULATED';

  // Construct hierarchy breadcrumb
  const breadcrumbs = [
    location.country || 'India',
    location.state,
    location.city,
  ].filter(Boolean);

  const handleScrollToMap = () => {
    const el = document.getElementById('interactive-map');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative overflow-hidden p-6 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark">
      {/* Subtle background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-cyan-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          {/* Eyebrow & Breadcrumbs */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-cyan-400 border border-brand-500/20">
              <Globe className="h-3 w-3" /> SAM Node
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="font-medium text-foreground/80">{breadcrumbs.join(' › ')}</span>
          </div>

          {/* Heading */}
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
            {/* Status Badge */}
            {dataSourceStatus === 'LIVE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-2xs" />
                Live Sensor Feed
              </span>
            ) : dataSourceStatus === 'ESTIMATED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                <Compass className="h-3 w-3 text-sky-500" />
                Spatial Estimate
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted/80 text-muted-foreground border border-border/60">
                <Radio className="h-3 w-3 text-cyan-500" />
                Telemetry Node
              </span>
            )}
          </div>

          {/* Geographic Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
            <div className="flex items-center gap-1.5 font-mono bg-muted/50 dark:bg-navy-950/50 px-2.5 py-1 rounded-lg border border-border/60 dark:border-navy-800">
              <MapPin className="h-3 w-3 text-cyan-500" />
              <span>
                {location.lat.toFixed(4)}° N, {location.lon.toFixed(4)}° E
              </span>
            </div>

            {nearestSt ? (
              <div className="flex items-center gap-1.5 bg-muted/50 dark:bg-navy-950/50 px-2.5 py-1 rounded-lg border border-border/60 dark:border-navy-800">
                <Waves className="h-3 w-3 text-teal-500" />
                <span>
                  Hydrological Station: <strong className="text-foreground">{nearestSt}</strong> ({nearestDist} km)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-muted/50 dark:bg-navy-950/50 px-2.5 py-1 rounded-lg border border-border/60 dark:border-navy-800">
                <Waves className="h-3 w-3 text-teal-500" />
                <span>Subarnarekha Basin · NAQUIM Aquifer Grid</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls & Telemetry Freshness */}
        <div className="flex flex-wrap items-center gap-3 pt-2 lg:pt-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 dark:bg-navy-950/60 px-3.5 py-2 rounded-xl border border-border/60 dark:border-navy-800">
            <span
              className={`w-2 h-2 rounded-full ${
                isWsConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-cyan-500'
              }`}
            />
            <span className="font-medium text-foreground">
              {secondsAgo === 0 ? 'Synchronized just now' : `Synchronized ${secondsAgo}s ago`}
            </span>
          </div>

          <button
            onClick={onRefetch}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/80 dark:border-navy-750 bg-card hover:bg-muted dark:hover:bg-navy-800 text-foreground text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
            title="Refresh real-time telemetry stream"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-500' : 'text-muted-foreground'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleScrollToMap}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition-all shadow-xs hover:border-cyan-500/50"
            title="Scroll to GIS canvas"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>View on Map</span>
          </button>
        </div>
      </div>
    </div>
  );
}


export default function Home() {
  const [activeTab, setActiveTab] = useState('weather');
  const { location, selectLocation } = useLocation();
  const { data, loading, error, secondsAgo, isWsConnected, refetch } = useEnvironmentData(
    location?.lat ?? null,
    location?.lon ?? null
  );

  // Geographic Hierarchy Filter State (Country -> State -> District -> City)
  const [geoFilter, setGeoFilter] = useState<GeoFilterState>({
    country: 'India',
    state: '',
    district: '',
    city: '',
  });
  const [wellSearchQuery, setWellSearchQuery] = useState('');
  const [matchingWellsCount, setMatchingWellsCount] = useState<number | undefined>(undefined);
  const [detailsWellId, setDetailsWellId] = useState<string | null>(null);
  const [wellsList, setWellsList] = useState<any[]>([]);
  const [loadingWells, setLoadingWells] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoadingWells(true);
    const params: any = { ...geoFilter };
    if (wellSearchQuery.trim()) {
      params.search = wellSearchQuery.trim();
    }
    wellService
      .getWells(params)
      .then((res) => {
        if (isMounted) {
          setWellsList(res || []);
          if (res) setMatchingWellsCount(res.length);
        }
      })
      .catch((err) => {
        console.error('Failed to load wells for filter:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingWells(false);
      });
    return () => {
      isMounted = false;
    };
  }, [geoFilter, wellSearchQuery]);

  const handleResetGeoFilter = () => {
    setGeoFilter({
      country: '',
      state: '',
      district: '',
      city: '',
    });
    setWellSearchQuery('');
  };

  const displayLocation = data?.location
    ? { ...location!, ...data.location }
    : location;

  const handleTabChange = (tab: string) => {
    if (tab === 'dashboard' || tab === 'map') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-brand-500 selection:text-white">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isWsConnected={isWsConnected}
      />

      <main className="flex-1 pb-16">
        <div className="container py-6 space-y-6">

          {/* Unified Spatial Command Deck */}
          <div className="p-4 sm:p-5 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/50 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight">
                    Spatial Search & Geographic Command
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Query any global latitude/longitude or filter through Indian hydrographic sectors
                  </p>
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1 hidden md:inline">Presets:</span>
                {DEMO_LOCATIONS.slice(0, 4).map((loc) => (
                  <button
                    key={loc.name}
                    onClick={() => selectLocation(loc.lat, loc.lon, loc.name)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/70 dark:border-navy-750 bg-background hover:bg-muted dark:hover:bg-navy-800 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 shadow-2xs hover:scale-105"
                  >
                    <LocateFixed className="h-3 w-3 text-cyan-500" />
                    <span>{loc.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Spatial & Well Search Bar */}
            <LocationSearch
              onLocationSelect={selectLocation}
              onWellSelect={(wellId) => setDetailsWellId(wellId)}
              searchQuery={wellSearchQuery}
              onSearchChange={(q) => setWellSearchQuery(q)}
            />

            {/* Geographic Hierarchy Filter (Country -> State -> District -> City) */}
            <GeoHierarchyFilter
              filter={geoFilter}
              onChange={setGeoFilter}
              onReset={handleResetGeoFilter}
              matchingWellsCount={matchingWellsCount}
            />
          </div>

          {/* Interactive GIS Map Container */}
          <div
            id="interactive-map"
            className="p-4 sm:p-5 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-3 scroll-mt-20"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-500" />
                    Interactive Environmental GIS Canvas
                  </h2>
                  {matchingWellsCount !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {matchingWellsCount} {matchingWellsCount === 1 ? 'Well' : 'Wells'} Filtered
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sub-kilometer spatial resolution · Click anywhere on the map or click a monitored well marker to inspect telemetry
                </p>
              </div>

              {location && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-mono font-medium px-3 py-1 rounded-xl bg-muted/60 dark:bg-navy-950/60 border border-border/60 dark:border-navy-800 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-cyan-500" />
                  <span>
                    Selected: {location.lat.toFixed(4)}°, {location.lon.toFixed(4)}°
                  </span>
                </div>
              )}
            </div>

            <MapView
              onLocationSelect={selectLocation}
              selectedLat={location?.lat ?? null}
              selectedLon={location?.lon ?? null}
              filterParams={{ ...geoFilter, search: wellSearchQuery }}
              onFilteredWellsCountChange={setMatchingWellsCount}
              onResetFilter={handleResetGeoFilter}
              onViewWellDetails={(id) => setDetailsWellId(id)}
            />
          </div>

          {/* Monitored Groundwater Wells Telemetry Grid */}
          <div className="p-5 sm:p-6 rounded-3xl bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl border border-border/80 dark:border-navy-750 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-border/50 dark:border-navy-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                  <Waves className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <span>Monitored Groundwater Wells</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {wellsList.length} {wellsList.length === 1 ? 'Station' : 'Stations'} Monitored
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Hydrostatic stage telemetry, subsurface stratigraphy, and hydrochemical analysis
                  </p>
                </div>
              </div>

              {/* Water Flow Animation Pipe Component */}
              <div className="w-full md:w-64">
                <WaterFlowPipe
                  orientation="horizontal"
                  flowDirection="forward"
                  active={true}
                  label="Aquifer Infiltration Conduit"
                />
              </div>
            </div>

            {/* Direct Well Search Bar & Active Scope Indicator */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-cyan-600 dark:text-cyan-400 pointer-events-none" />
                <input
                  type="text"
                  value={wellSearchQuery}
                  onChange={(e) => setWellSearchQuery(e.target.value)}
                  placeholder="Search by well ID (e.g. WELL-8D2930), name, city..."
                  className="w-full pl-10 pr-10 py-2 rounded-xl border border-border/80 dark:border-navy-750 bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 shadow-2xs transition-all"
                />
                {wellSearchQuery && (
                  <button
                    onClick={() => setWellSearchQuery('')}
                    className="absolute right-3 top-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {wellSearchQuery && (
                <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-medium">
                    Filter: "{wellSearchQuery}"
                  </span>
                  <button
                    onClick={() => setWellSearchQuery('')}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {loadingWells && wellsList.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64 rounded-3xl" />
                ))}
              </div>
            ) : wellsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wellsList.map((well) => (
                  <WellCard
                    key={well.id}
                    well={well}
                    onViewDetails={(id) => setDetailsWellId(id)}
                    onSelectOnMap={(lat, lon, name) => {
                      selectLocation(lat, lon, name);
                      const el = document.getElementById('dashboard-overview');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="p-10 rounded-2xl border border-dashed border-border/80 text-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <Search className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">No wells found</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {wellSearchQuery
                      ? `No monitoring wells match "${wellSearchQuery}" within the active geographic filters.`
                      : 'No monitoring wells registered in this geographic scope. Adjust filters above to expand view.'}
                  </p>
                </div>
                {(wellSearchQuery || geoFilter.state || geoFilter.district || geoFilter.city) && (
                  <button
                    onClick={() => {
                      setWellSearchQuery('');
                      handleResetGeoFilter();
                    }}
                    className="mt-1 px-4 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 text-xs font-semibold transition-colors"
                  >
                    Reset Search & Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Main Dashboard Section */}
          {!location ? (
            <EmptyState onSelect={selectLocation} />
          ) : (
            <div id="dashboard-overview" className="space-y-6 pt-2 scroll-mt-20">
              <LocationHeader
                location={displayLocation ?? location}
                data={data}
                secondsAgo={secondsAgo}
                loading={loading}
                isWsConnected={isWsConnected}
                onRefetch={refetch}
              />

              {loading && !data && <DashboardSkeleton />}

              {error && (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <div className="font-bold">Error loading live telemetry</div>
                    <div className="text-xs opacity-90">{error.message}. Automatic failover in progress.</div>
                  </div>
                </div>
              )}

              {data && (
                <>
                  {/* 4 Core Overview Cards */}
                  <EnvironmentOverview data={data} />

                  {/* Detailed Analysis Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1.5 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl border border-border/80 dark:border-navy-750 p-2 rounded-2xl shadow-enterprise dark:shadow-enterprise-dark">
                      <TabsTrigger
                        value="weather"
                        className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-600 dark:data-[state=active]:text-cyan-400 data-[state=active]:border data-[state=active]:border-cyan-500/30 data-[state=active]:shadow-xs flex items-center justify-center gap-2"
                      >
                        <CloudSun className="h-4 w-4 text-cyan-500" />
                        <span>Weather</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="water-level"
                        className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-teal-500/15 data-[state=active]:text-teal-600 dark:data-[state=active]:text-teal-400 data-[state=active]:border data-[state=active]:border-teal-500/30 data-[state=active]:shadow-xs flex items-center justify-center gap-2"
                      >
                        <Waves className="h-4 w-4 text-teal-500" />
                        <span>Water Level</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="water-quality"
                        className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:border data-[state=active]:border-blue-500/30 data-[state=active]:shadow-xs flex items-center justify-center gap-2"
                      >
                        <Droplets className="h-4 w-4 text-blue-500" />
                        <span>Water Quality</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="air-quality"
                        className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-600 dark:data-[state=active]:text-sky-400 data-[state=active]:border data-[state=active]:border-sky-500/30 data-[state=active]:shadow-xs flex items-center justify-center gap-2"
                      >
                        <Wind className="h-4 w-4 text-sky-500" />
                        <span>Air Quality</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="risk"
                        className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:border data-[state=active]:border-amber-500/30 data-[state=active]:shadow-xs flex items-center justify-center gap-2"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span>Risk Intelligence</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="analytics"
                        className="flex-1 min-w-[140px] rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border data-[state=active]:border-indigo-500/30 data-[state=active]:shadow-xs flex items-center justify-center gap-2"
                      >
                        <LineChart className="h-4 w-4 text-indigo-500" />
                        <span>Analytics</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="weather"
                      className="p-6 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark animate-in fade-in-50 duration-200 mt-2"
                    >
                      <WeatherSection weather={data.weather} lat={location.lat} lon={location.lon} />
                    </TabsContent>

                    <TabsContent
                      value="water-level"
                      className="p-6 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark animate-in fade-in-50 duration-200 mt-2"
                    >
                      <WaterSection waterLevel={data.water_level} lat={location.lat} lon={location.lon} />
                    </TabsContent>

                    <TabsContent
                      value="water-quality"
                      className="p-6 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark animate-in fade-in-50 duration-200 mt-2"
                    >
                      <WaterQualitySection waterQuality={data.water_quality} lat={location.lat} lon={location.lon} />
                    </TabsContent>

                    <TabsContent
                      value="air-quality"
                      className="p-6 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark animate-in fade-in-50 duration-200 mt-2"
                    >
                      <AirQualitySection airQuality={data.air_quality} lat={location.lat} lon={location.lon} />
                    </TabsContent>

                    <TabsContent
                      value="risk"
                      className="p-6 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark animate-in fade-in-50 duration-200 mt-2"
                    >
                      <RiskSection risk={data.risk} />
                    </TabsContent>

                    <TabsContent
                      value="analytics"
                      className="p-6 rounded-3xl border border-border/80 dark:border-navy-750 bg-card/75 dark:bg-navy-900/75 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark animate-in fade-in-50 duration-200 mt-2"
                    >
                      <AnalyticsSection lat={location.lat} lon={location.lon} />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )}

          {/* Well Details Modal */}
          <WellDetailsModal
            wellId={detailsWellId}
            isOpen={!!detailsWellId}
            onClose={() => setDetailsWellId(null)}
            onSelectOnMap={(lat, lon, name) => {
              selectLocation(lat, lon, name);
              const el = document.getElementById('interactive-map');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </main>

      <footer className="border-t border-border/80 dark:border-navy-800 py-8 text-xs text-muted-foreground bg-card/40 dark:bg-navy-950/40 backdrop-blur">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-brand-600 via-cyan-500 to-teal-400 flex items-center justify-center text-white font-black text-xs shadow-xs">
              S
            </div>
            <span className="font-bold text-foreground text-sm tracking-tight">SAM</span>
            <span className="text-muted-foreground/50">|</span>
            <span>Enterprise Environmental Intelligence Platform</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span>Atmospheric: Open-Meteo & Live Radar</span>
            <span>•</span>
            <span>Hydrology: PostGIS Proximity Engine</span>
            <span>•</span>
            <span>Telemetry: MQTT / ESP32 Sensor Grid</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
