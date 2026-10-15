// ─── Data Source Enums ────────────────────────────────────────────────────────
export type DataStatus = 'LIVE' | 'ESTIMATED' | 'SIMULATED' | 'UNAVAILABLE';
export type DataSource = 'MONITORING_STATION' | 'IOT_SENSOR' | 'WEATHER_API' | 'SYNTHETIC';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type WaterTrend = 'RISING' | 'FALLING' | 'STABLE';
export type WaterQualityCategory = 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS';
export type AirQualityCategory = 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';

// ─── Data Source Info ─────────────────────────────────────────────────────────
export interface DataSourceInfo {
  status: DataStatus;
  source: DataSource;
  source_label: string;
  updated_at: string;
  station_name?: string;
  station_distance_km?: number;
}

// ─── Location ─────────────────────────────────────────────────────────────────
export interface SelectedLocation {
  lat: number;
  lon: number;
  display_name: string;
  city?: string;
  state?: string;
  country?: string;
}

// ─── Weather ──────────────────────────────────────────────────────────────────
export interface WeatherData {
  timestamp: string;
  data_source: DataSourceInfo;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  cloud_cover: number;
  uv_index: number;
  visibility: number;
}

// ─── Water Level ──────────────────────────────────────────────────────────────
export interface WaterLevelData {
  timestamp: string;
  data_source: DataSourceInfo;
  water_level: number;
  trend: WaterTrend;
  daily_variation: number;
  warning_level_m: number;
  danger_level_m: number;
  historical_max_m?: number;
  flow_rate_cumecs?: number;
  change_1h_m?: number;
  nearest_station?: string;
  nearest_station_distance_km?: number;
}

// ─── Water Quality ────────────────────────────────────────────────────────────
export interface WaterQualityData {
  timestamp: string;
  data_source: DataSourceInfo;
  ph: number;
  turbidity: number;
  tds: number;
  temperature: number;
  dissolved_oxygen: number;
  electrical_conductivity?: number;
  category: WaterQualityCategory;
}

// ─── Air Quality ──────────────────────────────────────────────────────────────
export interface AirQualityData {
  timestamp: string;
  data_source: DataSourceInfo;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  o3: number;
  co: number;
  category: string;
}

// ─── Risk ─────────────────────────────────────────────────────────────────────
export interface RiskFactor {
  category: string;
  level: RiskLevel;
  score: number;
  description: string;
}

export interface RiskData {
  timestamp: string;
  data_source: DataSourceInfo;
  overall_level: RiskLevel;
  overall_score: number;
  factors: RiskFactor[];
}

// ─── Combined Environment Response ────────────────────────────────────────────
export interface EnvironmentData {
  location: SelectedLocation;
  weather: WeatherData;
  water_level: WaterLevelData;
  water_quality: WaterQualityData;
  air_quality: AirQualityData;
  risk: RiskData;
  timestamp: string;
}

// ─── History ──────────────────────────────────────────────────────────────────
export interface HistoryPoint {
  timestamp: string;
  value: number;
  [key: string]: number | string;
}

export interface HistoryResponse {
  source: string;
  status: string;
  metric: string;
  lat: number;
  lon: number;
  hours: number;
  interval_minutes: number;
  data_points: number;
  history: HistoryPoint[];
}

// ─── Monitoring Station ───────────────────────────────────────────────────────
export interface MonitoringStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: 'WATER' | 'AIR' | 'IOT' | 'WELL';
  distance_km: number;
  is_active: boolean;
  latest_reading?: WellReading | {
    water_level_m: number;
    ph: number;
    tds_ppm: number;
    turbidity_ntu: number;
    dissolved_oxygen_mg_l: number;
    temperature_c: number;
    status: string;
    source?: string;
    timestamp?: string;
  };
  warning_level_m?: number;
  danger_level_m?: number;
  location_description?: string;
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  total_depth_m?: number | null;
  lithology_count?: number;
  lithology_status?: 'RECORDED' | 'PARTIAL' | 'NONE' | string;
  total_logged_depth_m?: number;
  created_by?: number | null;
  creator?: {
    id: number;
    name?: string | null;
    email?: string | null;
    username: string;
    role?: string | null;
  } | null;
}

export interface WellSensor {
  id: string;
  sensor_type: string;
  model: string;
  is_active: boolean;
  installed_at: string;
}

export interface WellReading {
  id: number;
  well_id: string;
  sensor_id?: string;
  water_level_m: number;
  ph: number;
  tds_ppm: number;
  turbidity_ntu: number;
  dissolved_oxygen_mg_l: number;
  temperature_c: number;
  status: string;
  source: string;
  timestamp: string;
}

export interface WellRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  location_description?: string;
  warning_level_m: number;
  danger_level_m: number;
  total_depth_m?: number | null;
  lithology_count?: number;
  lithology_status?: 'RECORDED' | 'PARTIAL' | 'NONE' | string;
  total_logged_depth_m?: number;
  is_active: boolean;
  created_at: string;
  created_by?: number | null;
  creator?: {
    id: number;
    name?: string | null;
    email?: string | null;
    username: string;
    role?: string | null;
  } | null;
  sensors: WellSensor[];
  latest_reading?: WellReading;
}

// ─── Weather Code Labels ──────────────────────────────────────────────────────
export function getWeatherLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

export function getWindDirection(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}
