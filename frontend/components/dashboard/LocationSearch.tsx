'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Compass, X, Loader2, Navigation, Waves } from 'lucide-react';
import { locationService, wellService, type LocationSearchResult } from '@/services/api';

interface LocationSearchProps {
  onLocationSelect: (lat: number, lon: number, name?: string) => void;
  onWellSelect?: (wellId: string) => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export function LocationSearch({
  onLocationSelect,
  onWellSelect,
  searchQuery = '',
  onSearchChange,
}: LocationSearchProps) {
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [matchingWells, setMatchingWells] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize internal query with external searchQuery prop
  useEffect(() => {
    setInternalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!internalQuery.trim()) {
      setResults([]);
      setMatchingWells([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [locRes, wellRes] = await Promise.allSettled([
          locationService.search(internalQuery),
          wellService.getWells({ search: internalQuery }),
        ]);

        const locs = locRes.status === 'fulfilled' ? locRes.value : [];
        const wells = wellRes.status === 'fulfilled' && Array.isArray(wellRes.value) ? wellRes.value : [];

        setResults(locs);
        setMatchingWells(wells);
        setIsOpen(true);
      } catch {
        setResults([]);
        setMatchingWells([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [internalQuery]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalQuery(val);
    onSearchChange?.(val);
  };

  const handleClear = () => {
    setInternalQuery('');
    setResults([]);
    setMatchingWells([]);
    setIsOpen(false);
    onSearchChange?.('');
    inputRef.current?.focus();
  };

  const handleSelectLocation = (result: LocationSearchResult) => {
    onLocationSelect(result.lat, result.lon, result.display_name);
    setIsOpen(false);
  };

  const handleSelectWell = (well: any) => {
    onLocationSelect(well.latitude, well.longitude, well.name);
    onWellSelect?.(well.id);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-cyan-600 dark:text-cyan-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={internalQuery}
          onChange={handleInputChange}
          placeholder="Search well ID (e.g. WELL-8D2930), station name, city, basin, or coordinates..."
          className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border/80 dark:border-navy-750 bg-card/90 backdrop-blur-md shadow-xs text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400" />}
          {internalQuery && !loading && (
            <button
              onClick={handleClear}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground/70 bg-muted/60 border border-border/60">
            {internalQuery ? 'Search active' : 'Well & Map'}
          </span>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark overflow-hidden z-[1100] text-xs animate-in fade-in slide-in-from-top-2">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
              <span>Searching monitoring stations and geographic registry...</span>
            </div>
          ) : matchingWells.length > 0 || results.length > 0 ? (
            <div className="max-h-88 overflow-y-auto divide-y divide-border/60">
              {/* Monitored Wells Section */}
              {matchingWells.length > 0 && (
                <div>
                  <div className="px-3.5 py-1.5 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                      <Waves className="h-3 w-3" /> Monitored Groundwater Wells
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono text-[9px]">
                      {matchingWells.length} found
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {matchingWells.map((well) => (
                      <button
                        key={well.id}
                        onClick={() => handleSelectWell(well)}
                        className="w-full px-4 py-2 text-left hover:bg-cyan-500/5 flex items-center gap-3 transition-colors text-foreground group"
                      >
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                          <span className="text-xs">🚰</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                              {well.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border/60 shrink-0">
                              {well.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {[well.city, well.district, well.state].filter(Boolean).join(', ') || 'Monitored Well'}
                          </div>
                        </div>
                        {well.latest_reading && (
                          <div className="flex items-center gap-1 shrink-0 text-[11px] font-mono font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                            <span>{well.latest_reading.water_level_m.toFixed(2)}m</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Geographic Locations Section */}
              {results.length > 0 && (
                <div>
                  <div className="px-3.5 py-1.5 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-teal-500" /> Geographic Locations & Catchments
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[9px]">
                      {results.length} found
                    </span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {results.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectLocation(r)}
                        className="w-full px-4 py-2 text-left hover:bg-muted/50 flex items-center gap-3 transition-colors text-foreground group"
                      >
                        <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 group-hover:scale-105 transition-transform">
                          {r.type === 'RIVER' ? (
                            <span className="text-xs">🌊</span>
                          ) : r.type === 'STATION' ? (
                            <span className="text-xs">📡</span>
                          ) : r.type === 'COORDINATE' ? (
                            <Compass className="h-3.5 w-3.5" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                            {r.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{r.display_name}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                          <Navigation className="h-3 w-3 text-cyan-500" />
                          <span>
                            {r.lat.toFixed(3)}°, {r.lon.toFixed(3)}°
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs font-medium text-foreground">No wells or locations found</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                No monitoring wells or map locations matched "{internalQuery}". Try searching by well ID (e.g. WELL-8D2930), station name, or city.
              </p>
              <button
                onClick={handleClear}
                className="mt-1 px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
