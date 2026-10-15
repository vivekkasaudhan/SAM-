'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Compass, X, Loader2, Navigation } from 'lucide-react';
import { locationService, type LocationSearchResult } from '@/services/api';

interface LocationSearchProps {
  onLocationSelect: (lat: number, lon: number, name?: string) => void;
}

export function LocationSearch({ onLocationSelect }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await locationService.search(query);
        setResults(res);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

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

  const handleSelect = (result: LocationSearchResult) => {
    onLocationSelect(result.lat, result.lon, result.display_name);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-cyan-600 dark:text-cyan-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city, district, catchment, river basin, or coordinates (e.g. Lucknow, Jamshedpur, 22.80, 86.20)..."
          className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-border/80 dark:border-navy-750 bg-card/90 backdrop-blur-md shadow-xs text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400" />}
          {query && !loading && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground/70 bg-muted/60 border border-border/60">
            Spatial Search
          </span>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-enterprise dark:shadow-enterprise-dark overflow-hidden z-[1100] text-xs animate-in fade-in slide-in-from-top-2">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
              <span>Querying global spatial registry...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(r)}
                  className="w-full px-4 py-2.5 text-left hover:bg-muted/50 flex items-center gap-3 transition-colors text-foreground group"
                >
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                    {r.type === 'RIVER' ? (
                      <span className="text-sm">🌊</span>
                    ) : r.type === 'STATION' ? (
                      <span className="text-sm">📡</span>
                    ) : r.type === 'COORDINATE' ? (
                      <Compass className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">
                      {r.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.display_name}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded-md border border-border/60">
                    <Navigation className="h-3 w-3 text-cyan-500" />
                    <span>
                      {r.lat.toFixed(4)}°, {r.lon.toFixed(4)}°
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No matching locations found. Try searching by city name, river basin, or coordinates (e.g. 26.83, 80.93).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
