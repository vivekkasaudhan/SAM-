'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface TelemetryUpdate {
  type: string;
  timestamp: string;
  location: { lat: number; lon: number };
  water_level?: any;
  water_quality?: any;
  air_quality?: any;
}

export function useWebSocket(lat: number | null, lon: number | null) {
  const [telemetry, setTelemetry] = useState<TelemetryUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http:\/\//, '').replace(/^https:\/\//, '')
      : 'localhost:8000';

    const wsUrl = `${protocol}//${host}/ws/updates`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (lat !== null && lon !== null) {
          ws.send(JSON.stringify({ action: 'subscribe', lat, lon }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TELEMETRY_STREAM' || data.type === 'SENSOR_UPDATE') {
            setTelemetry(data);
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [lat, lon]);

  // Handle location subscription change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (lat !== null && lon !== null) {
        wsRef.current.send(JSON.stringify({ action: 'subscribe', lat, lon }));
      }
    }
  }, [lat, lon]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { telemetry, isConnected };
}
