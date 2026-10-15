'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { environmentService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { EnvironmentData } from '@/types/environment';

interface UseEnvironmentDataReturn {
  data: EnvironmentData | null;
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  secondsAgo: number;
  isWsConnected: boolean;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useEnvironmentData(
  lat: number | null,
  lon: number | null
): UseEnvironmentDataReturn {
  const [data, setData] = useState<EnvironmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time WebSocket connection
  const { telemetry, isConnected: isWsConnected } = useWebSocket(lat, lon);

  const fetchData = useCallback(async () => {
    if (lat === null || lon === null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await environmentService.getEnvironmentData(lat, lon);
      setData(result);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  // Fetch immediately when location changes
  useEffect(() => {
    if (lat === null || lon === null) {
      setData(null);
      setError(null);
      setLastUpdated(null);
      return;
    }

    fetchData();

    // Background poll every 30s as heartbeat
    pollRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [lat, lon, fetchData]);

  // Integrate incoming WebSocket telemetry stream
  useEffect(() => {
    if (!telemetry || !data) return;

    setData((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };

      if (telemetry.water_level) {
        updated.water_level = {
          ...prev.water_level,
          ...telemetry.water_level,
        };
      }
      if (telemetry.water_quality) {
        updated.water_quality = {
          ...prev.water_quality,
          ...telemetry.water_quality,
        };
      }
      if (telemetry.air_quality) {
        updated.air_quality = {
          ...prev.air_quality,
          ...telemetry.air_quality,
        };
      }
      return updated;
    });

    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, [telemetry]);

  // Update "seconds ago" counter every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (lastUpdated) {
        setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lastUpdated]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    secondsAgo,
    isWsConnected,
    refetch: fetchData,
  };
}
