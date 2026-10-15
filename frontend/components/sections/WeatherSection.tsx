'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, Wind, Eye, Droplets, Thermometer, Gauge, Sun, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { WeatherChart } from '@/components/charts/Charts';
import { forecastService } from '@/services/api';
import type { WeatherData } from '@/types/environment';
import { getWeatherLabel, getWeatherIcon, getWindDirection } from '@/types/environment';
import { Skeleton } from '@/components/ui/skeleton';

interface WeatherSectionProps {
  weather: WeatherData;
  lat: number;
  lon: number;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-background shadow-sm text-brand-500">
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div className="text-lg font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function WeatherSection({ weather, lat, lon }: WeatherSectionProps) {
  const [forecast, setForecast] = useState<any>(null);
  const [loadingForecast, setLoadingForecast] = useState(true);

  useEffect(() => {
    forecastService.getForecast(lat, lon, 48)
      .then(setForecast)
      .catch(() => null)
      .finally(() => setLoadingForecast(false));
  }, [lat, lon]);

  const icon = getWeatherIcon(weather.weather_code);
  const label = getWeatherLabel(weather.weather_code);
  const windDir = getWindDirection(weather.wind_direction_10m);

  const uvLabel =
    weather.uv_index < 3 ? 'Low' :
    weather.uv_index < 6 ? 'Moderate' :
    weather.uv_index < 8 ? 'High' :
    weather.uv_index < 11 ? 'Very High' : 'Extreme';

  return (
    <div className="space-y-6">
      {/* Current conditions */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-5xl">{icon}</span>
            <div>
              <div className="text-5xl font-bold">{weather.temperature_2m.toFixed(1)}°C</div>
              <div className="text-muted-foreground">{label} · Feels like {weather.apparent_temperature.toFixed(1)}°C</div>
            </div>
          </div>
        </div>
        <DataSourceBadge info={weather.data_source} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={<Droplets className="h-5 w-5" />} label="Humidity" value={`${weather.relative_humidity_2m}%`} />
        <StatCard icon={<Cloud className="h-5 w-5" />} label="Rainfall" value={`${weather.precipitation.toFixed(1)} mm`} sub="current hour" />
        <StatCard icon={<Wind className="h-5 w-5" />} label="Wind" value={`${weather.wind_speed_10m.toFixed(0)} km/h`} sub={windDir} />
        <StatCard icon={<Navigation className="h-5 w-5" />} label="Gusts" value={`${weather.wind_gusts_10m.toFixed(0)} km/h`} />
        <StatCard icon={<Gauge className="h-5 w-5" />} label="Pressure" value={`${weather.surface_pressure.toFixed(0)} hPa`} />
        <StatCard icon={<Cloud className="h-5 w-5" />} label="Cloud Cover" value={`${weather.cloud_cover}%`} />
        <StatCard icon={<Sun className="h-5 w-5" />} label="UV Index" value={`${weather.uv_index.toFixed(1)}`} sub={uvLabel} />
        <StatCard icon={<Eye className="h-5 w-5" />} label="Visibility" value={`${(weather.visibility / 1000).toFixed(1)} km`} />
      </div>

      {/* Forecast chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">48-Hour Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingForecast ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <WeatherChart lat={lat} lon={lon} forecastData={forecast} />
          )}
        </CardContent>
      </Card>

      {/* 7-day summary */}
      {forecast?.forecast && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">7-Day Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 text-center">
              {(forecast.forecast.daily_weather_codes ?? []).slice(0, 7).map((code: number, i: number) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dayLabel = i === 0 ? 'Today' : date.toLocaleDateString('en', { weekday: 'short' });
                return (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">{dayLabel}</div>
                    <div className="text-2xl">{getWeatherIcon(code)}</div>
                    <div className="text-xs font-bold">
                      {(forecast.forecast.daily_max_temp?.[i] ?? '--')}° / {(forecast.forecast.daily_min_temp?.[i] ?? '--')}°
                    </div>
                    <div className="text-xs text-blue-500">{(forecast.forecast.daily_precip?.[i] ?? 0).toFixed(0)} mm</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
