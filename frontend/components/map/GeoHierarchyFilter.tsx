'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Globe, MapPin, ChevronRight, RotateCcw, Filter, Loader2, CheckCircle2 } from 'lucide-react';
import { geoService } from '@/services/api';

export interface GeoFilterState {
  country: string;
  state: string;
  district: string;
  city: string;
}

interface GeoHierarchyFilterProps {
  filter: GeoFilterState;
  onChange: (newFilter: GeoFilterState) => void;
  onReset: () => void;
  matchingWellsCount?: number;
  totalWellsCount?: number;
  loadingWells?: boolean;
}

export function GeoHierarchyFilter({
  filter,
  onChange,
  onReset,
  matchingWellsCount,
  totalWellsCount,
  loadingWells = false,
}: GeoHierarchyFilterProps) {
  // Cascading options
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  // Loading states for each dropdown
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // 1. Load initial countries on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingCountries(true);
    geoService
      .getCountries()
      .then((data) => {
        if (isMounted) setCountries(data);
      })
      .catch(() => {
        if (isMounted) setCountries(['India', 'United States', 'United Kingdom']);
      })
      .finally(() => {
        if (isMounted) setLoadingCountries(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load states when country changes
  useEffect(() => {
    if (!filter.country) {
      setStates([]);
      setDistricts([]);
      setCities([]);
      return;
    }
    let isMounted = true;
    setLoadingStates(true);
    geoService
      .getStates(filter.country)
      .then((data) => {
        if (isMounted) setStates(data);
      })
      .catch(() => {
        if (isMounted) setStates([]);
      })
      .finally(() => {
        if (isMounted) setLoadingStates(false);
      });
    return () => {
      isMounted = false;
    };
  }, [filter.country]);

  // 3. Load districts when state changes, retaining district if valid in new state
  useEffect(() => {
    if (!filter.state) {
      setDistricts([]);
      return;
    }
    let isMounted = true;
    setLoadingDistricts(true);
    geoService
      .getDistricts(filter.state, filter.country)
      .then((data) => {
        if (!isMounted) return;
        setDistricts(data);
        // Only reset district/city if current district is no longer valid for the newly selected state
        if (
          filter.district &&
          !data.some((d) => d.trim().toLowerCase() === filter.district.trim().toLowerCase())
        ) {
          onChange({
            ...filter,
            district: '',
            city: '',
          });
        }
      })
      .catch(() => {
        if (isMounted) setDistricts([]);
      })
      .finally(() => {
        if (isMounted) setLoadingDistricts(false);
      });
    return () => {
      isMounted = false;
    };
  }, [filter.state, filter.country]);

  // 4. Load cities when district or state changes, retaining city if valid
  useEffect(() => {
    if (!filter.district && !filter.state) {
      setCities([]);
      return;
    }
    let isMounted = true;
    setLoadingCities(true);
    geoService
      .getCities(
        filter.district ? filter.district : undefined,
        filter.state ? filter.state : undefined,
        filter.country ? filter.country : undefined
      )
      .then((data) => {
        if (!isMounted) return;
        setCities(data);
        // Only reset city if current city is no longer valid for the new district/state scope
        if (
          filter.city &&
          !data.some((ci) => ci.trim().toLowerCase() === filter.city.trim().toLowerCase())
        ) {
          onChange({
            ...filter,
            city: '',
          });
        }
      })
      .catch(() => {
        if (isMounted) setCities([]);
      })
      .finally(() => {
        if (isMounted) setLoadingCities(false);
      });
    return () => {
      isMounted = false;
    };
  }, [filter.district, filter.state, filter.country]);

  // Handle parent dropdown changes with intelligent child validation
  const handleCountryChange = (val: string) => {
    onChange({
      country: val,
      state: '',
      district: '',
      city: '',
    });
  };

  const handleStateChange = async (val: string) => {
    if (!val) {
      onChange({
        ...filter,
        state: '',
        district: '',
        city: '',
      });
      return;
    }

    try {
      // Check if current district is valid for the newly selected state
      const validDistricts = await geoService.getDistricts(val, filter.country);
      const isDistrictValid =
        filter.district &&
        validDistricts.some((d) => d.trim().toLowerCase() === filter.district.trim().toLowerCase());

      if (isDistrictValid) {
        // District is still valid, check if city is also valid
        const validCities = await geoService.getCities(filter.district, val, filter.country);
        const isCityValid =
          filter.city &&
          validCities.some((c) => c.trim().toLowerCase() === filter.city.trim().toLowerCase());

        onChange({
          ...filter,
          state: val,
          district: filter.district,
          city: isCityValid ? filter.city : '',
        });
      } else {
        // District is invalid in new state -> reset child filters
        onChange({
          ...filter,
          state: val,
          district: '',
          city: '',
        });
      }
    } catch {
      onChange({
        ...filter,
        state: val,
        district: '',
        city: '',
      });
    }
  };

  const handleDistrictChange = async (val: string) => {
    if (!val) {
      onChange({
        ...filter,
        district: '',
        city: '',
      });
      return;
    }

    try {
      const validCities = await geoService.getCities(val, filter.state, filter.country);
      const isCityValid =
        filter.city &&
        validCities.some((c) => c.trim().toLowerCase() === filter.city.trim().toLowerCase());

      onChange({
        ...filter,
        district: val,
        city: isCityValid ? filter.city : '',
      });
    } catch {
      onChange({
        ...filter,
        district: val,
        city: '',
      });
    }
  };

  const handleCityChange = (val: string) => {
    onChange({
      ...filter,
      city: val,
    });
  };

  // Check if any filter is active
  const hasActiveFilter = Boolean(filter.country || filter.state || filter.district || filter.city);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark space-y-3.5">
      {/* Top Header: Title, Breadcrumbs, Well Count & Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-bold text-foreground mr-1">
            <Filter className="h-3.5 w-3.5 text-cyan-500" />
            <span>Scope:</span>
          </div>

          {/* Interactive Breadcrumb */}
          <button
            onClick={onReset}
            className={`px-2 py-0.5 rounded-md hover:bg-muted/80 transition-all font-medium ${
              !hasActiveFilter
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Locations
          </button>

          {filter.country && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <button
                onClick={() =>
                  onChange({
                    country: filter.country,
                    state: '',
                    district: '',
                    city: '',
                  })
                }
                className={`px-2 py-0.5 rounded-md hover:bg-muted/80 transition-all font-medium ${
                  !filter.state
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter.country}
              </button>
            </>
          )}

          {filter.state && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <button
                onClick={() =>
                  onChange({
                    country: filter.country,
                    state: filter.state,
                    district: '',
                    city: '',
                  })
                }
                className={`px-2 py-0.5 rounded-md hover:bg-muted/80 transition-all font-medium ${
                  !filter.district
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter.state}
              </button>
            </>
          )}

          {filter.district && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <button
                onClick={() =>
                  onChange({
                    country: filter.country,
                    state: filter.state,
                    district: filter.district,
                    city: '',
                  })
                }
                className={`px-2 py-0.5 rounded-md hover:bg-muted/80 transition-all font-medium ${
                  !filter.city
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter.district}
              </button>
            </>
          )}

          {filter.city && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20">
                {filter.city}
              </span>
            </>
          )}
        </div>

        {/* Counter Badge & Reset Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
            {loadingWells ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-cyan-500" />
                <span>Filtering wells...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>
                  {matchingWellsCount ?? 0} {matchingWellsCount === 1 ? 'Well' : 'Wells'} in Scope
                </span>
              </>
            )}
          </span>

          {hasActiveFilter && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/80"
              title="Reset all geographic filters"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Cascading Dropdowns: Country -> State -> District -> City */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Country */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-cyan-500" /> Country
            </span>
            {loadingCountries && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
          </label>
          <select
            value={filter.country}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="w-full h-9 px-3 py-1.5 text-xs rounded-xl bg-background border border-border/80 dark:border-navy-750 text-foreground shadow-xs focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 focus:outline-none transition-all cursor-pointer font-medium"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 2. State */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-teal-500" /> State / Province
            </span>
            {loadingStates && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
          </label>
          <select
            value={filter.state}
            onChange={(e) => handleStateChange(e.target.value)}
            disabled={!filter.country && states.length === 0}
            className="w-full h-9 px-3 py-1.5 text-xs rounded-xl bg-background border border-border/80 dark:border-navy-750 text-foreground shadow-xs focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 focus:outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <option value="">{filter.country ? `All States in ${filter.country}` : 'Select Country First'}</option>
            {states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* 3. District */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-cyan-500" /> District
            </span>
            {loadingDistricts && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
          </label>
          <select
            value={filter.district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={!filter.state}
            className="w-full h-9 px-3 py-1.5 text-xs rounded-xl bg-background border border-border/80 dark:border-navy-750 text-foreground shadow-xs focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 focus:outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <option value="">{filter.state ? `All Districts in ${filter.state}` : 'Select State First'}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* 4. City */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-sky-500" /> City / Municipality
            </span>
            {loadingCities && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
          </label>
          <select
            value={filter.city}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={!filter.district && !filter.state}
            className="w-full h-9 px-3 py-1.5 text-xs rounded-xl bg-background border border-border/80 dark:border-navy-750 text-foreground shadow-xs focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 focus:outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <option value="">
              {filter.district
                ? `All Cities in ${filter.district}`
                : filter.state
                ? `All Cities in ${filter.state}`
                : 'Select State or District First'}
            </option>
            {cities.map((ci) => (
              <option key={ci} value={ci}>
                {ci}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
