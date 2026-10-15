'use client';

import { useState, useCallback } from 'react';
import type { SelectedLocation } from '@/types/environment';

// Quick-select demo locations
export const DEMO_LOCATIONS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'NIT Jamshedpur Well 1', lat: 22.7772, lon: 86.1441 },
  { name: 'NIT Jamshedpur Well 2', lat: 22.7845, lon: 86.1492 },
  { name: 'Jamshedpur Center', lat: 22.8046, lon: 86.2029 },
  { name: 'Ranchi', lat: 23.3441, lon: 85.3096 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
];

interface UseLocationReturn {
  location: SelectedLocation | null;
  selectLocation: (lat: number, lon: number, name?: string) => void;
  clearLocation: () => void;
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<SelectedLocation | null>(null);

  const selectLocation = useCallback(
    (lat: number, lon: number, name?: string) => {
      setLocation({
        lat,
        lon,
        display_name: name || `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`,
      });
    },
    []
  );

  const clearLocation = useCallback(() => {
    setLocation(null);
  }, []);

  return { location, selectLocation, clearLocation };
}
