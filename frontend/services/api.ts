import axios, { AxiosInstance } from 'axios';
import type {
  EnvironmentData,
  HistoryResponse,
  MonitoringStation,
  SelectedLocation,
} from '@/types/environment';
import type { LithologyLayer, GeologyProfile } from '@/types/lithology';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Interceptor to inject bearer token from localStorage if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sam_token') || localStorage.getItem('aquasense_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Environment ──────────────────────────────────────────────────────────────
export const environmentService = {
  async getEnvironmentData(lat: number, lon: number): Promise<EnvironmentData> {
    const response = await api.get<EnvironmentData>('/api/environment', {
      params: { lat, lon },
    });
    return response.data;
  },
};

// ─── History ──────────────────────────────────────────────────────────────────
export const historyService = {
  async getHistory(
    lat: number,
    lon: number,
    metric: 'water_level' | 'water_quality' | 'air_quality',
    hours: number = 24,
    intervalMinutes: number = 30
  ): Promise<HistoryResponse> {
    const response = await api.get<HistoryResponse>('/api/history', {
      params: { lat, lon, metric, hours, interval_minutes: intervalMinutes },
    });
    return response.data;
  },
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AnalyticsResponse {
  comparison: string;
  lat: number;
  lon: number;
  hours: number;
  data_points: number;
  data: Array<Record<string, any>>;
}

export const analyticsService = {
  async getAnalytics(
    lat: number,
    lon: number,
    comparison: string = 'rainfall_vs_water_level',
    hours: number = 48
  ): Promise<AnalyticsResponse> {
    const response = await api.get<AnalyticsResponse>('/api/analytics', {
      params: { lat, lon, comparison, hours },
    });
    return response.data;
  },
};

// ─── Stations & Wells ─────────────────────────────────────────────────────────
export const stationService = {
  async getNearbyStations(
    lat: number,
    lon: number,
    radiusKm: number = 200
  ): Promise<MonitoringStation[]> {
    const response = await api.get<MonitoringStation[]>('/api/stations/nearby', {
      params: { lat, lon, radius_km: radiusKm },
    });
    return response.data;
  },
};

export interface MissingPeriod {
  from: string;
  to: string;
  type: string;
  duration_days?: number;
  duration_hours?: number;
  reason: string;
}

export interface HistoricalAnalysisResponse {
  well_id: string;
  well_name: string;
  selected_range: string;
  start_date: string;
  end_date: string;
  aggregation: string;
  total_records: number;
  has_missing_data: boolean;
  missing_periods: MissingPeriod[];
  data_source_summary: Record<string, number>;
  is_demo_history?: boolean;
  simulated_percentage?: number;
  simulated_records_count?: number;
  measured_records_count?: number;
  provenance_notice?: string;
  earliest_recorded_timestamp?: string | null;
  latest_recorded_timestamp?: string | null;
  readings: Array<{
    id?: number | null;
    well_id: string;
    sensor_id?: string | null;
    water_level_m: number;
    min_water_level_m?: number | null;
    max_water_level_m?: number | null;
    ph: number;
    tds_ppm: number;
    turbidity_ntu: number;
    dissolved_oxygen_mg_l: number;
    temperature_c: number;
    status: string;
    source: string;
    timestamp: string;
    reading_count?: number;
  }>;
}

export interface ForecastPoint {
  timestamp: string;
  day_offset: number;
  estimated_water_level_m: number;
  confidence_lower: number;
  confidence_upper: number;
  uncertainty_margin_m: number;
  expected_rainfall_mm: number;
  trend_component_m: number;
  recharge_component_m: number;
}

export interface ForecastBacktest {
  status: string;
  message?: string;
  mae?: number;
  rmse?: number;
  mean_bias_m?: number;
  train_samples: number;
  test_samples: number;
  train_period?: { start: string; end: string };
  test_period?: { start: string; end: string };
  points?: Array<{
    timestamp: string;
    actual_water_level_m: number;
    predicted_water_level_m: number;
    error_m: number;
  }>;
  limitations: string[];
}

export interface GroundwaterForecastResponse {
  well_id: string;
  well_name: string;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  reason?: string;
  is_demo: boolean;
  forecast_type: 'DEMO_SIMULATED' | 'PHYSICAL_TELEMETRY';
  disclaimer: string;
  forecast_label?: string;
  data_source_label?: string;
  horizon_days: number;
  generated_at: string;
  model_name: string;
  model_version: string;
  data_freshness: {
    total_readings: number;
    data_span_hours: number;
    data_span_days?: number;
    latest_observation?: string;
    earliest_observation?: string;
  };
  environmental_drivers: {
    rainfall_forecast_source: string;
    expected_rainfall_sum_mm: number;
    lithology_conductivity_factor: number;
    dominant_lithology: string;
    baseline_water_level_m?: number;
    linear_trend_m_per_day?: number;
  };
  predictions: ForecastPoint[];
  backtest?: ForecastBacktest | null;
  persisted_forecast_id?: number;
}

export const wellService = {
  async getWells(filters?: {
    country?: string;
    state?: string;
    district?: string;
    city?: string;
    is_active?: boolean;
    subadmin_id?: number | string;
    created_by?: number | string;
    search?: string;
    q?: string;
  }) {
    const response = await api.get('/api/wells', { params: filters });
    return response.data;
  },
  async getWell(id: string) {
    const response = await api.get(`/api/wells/${id}`);
    return response.data;
  },
  async getWellReadings(
    id: string,
    params?: number | {
      limit?: number;
      range?: 'recent' | '1y' | '2y' | '3y' | 'custom';
      start_date?: string;
      end_date?: string;
      aggregate?: 'auto' | 'raw' | 'hour' | 'day';
    }
  ) {
    const queryParams = typeof params === 'number' ? { limit: params } : (params || { limit: 50 });
    const response = await api.get(`/api/wells/${id}/readings`, { params: queryParams });
    return response.data;
  },
  async getWellHistoryAnalysis(
    id: string,
    params?: {
      range?: 'recent' | '1y' | '2y' | '3y' | 'custom';
      start_date?: string;
      end_date?: string;
      aggregate?: 'auto' | 'raw' | 'hour' | 'day';
      limit?: number;
    }
  ): Promise<HistoricalAnalysisResponse> {
    const response = await api.get<HistoricalAnalysisResponse>(`/api/wells/${id}/history-analysis`, {
      params,
    });
    return response.data;
  },
  async getWellForecast(
    id: string,
    params?: {
      horizon?: number;
      include_backtest?: boolean;
      persist?: boolean;
    }
  ): Promise<GroundwaterForecastResponse> {
    const response = await api.get<GroundwaterForecastResponse>(`/api/wells/${id}/forecast`, {
      params,
    });
    return response.data;
  },
  async createWell(data: any) {
    const response = await api.post('/api/wells', data);
    return response.data;
  },
  async updateWell(id: string, data: any) {
    const response = await api.put(`/api/wells/${id}`, data);
    return response.data;
  },
  async deleteWell(id: string) {
    const response = await api.delete(`/api/wells/${id}`);
    return response.data;
  },
  async backfillSimulation(wellId?: string, years: number = 3) {
    const response = await api.post('/api/scheduler/backfill', null, {
      params: { well_id: wellId, years },
    });
    return response.data;
  },
};

// ─── Lithology & Stratigraphy ─────────────────────────────────────────────────
export const lithologyService = {
  async getLayers(wellId: string): Promise<LithologyLayer[]> {
    const response = await api.get<LithologyLayer[]>(`/api/wells/${wellId}/lithology`);
    return response.data;
  },
  async getLayer(wellId: string, layerId: number): Promise<LithologyLayer> {
    const response = await api.get<LithologyLayer>(`/api/wells/${wellId}/lithology/${layerId}`);
    return response.data;
  },
  async createLayer(wellId: string, data: Partial<LithologyLayer>): Promise<LithologyLayer> {
    const response = await api.post<LithologyLayer>(`/api/wells/${wellId}/lithology`, data);
    return response.data;
  },
  async updateLayer(wellId: string, layerId: number, data: Partial<LithologyLayer>): Promise<LithologyLayer> {
    const response = await api.put<LithologyLayer>(`/api/wells/${wellId}/lithology/${layerId}`, data);
    return response.data;
  },
  async deleteLayer(wellId: string, layerId: number): Promise<{ message: string; id: number }> {
    const response = await api.delete<{ message: string; id: number }>(`/api/wells/${wellId}/lithology/${layerId}`);
    return response.data;
  },
  async getProfile(wellId: string): Promise<GeologyProfile> {
    const response = await api.get<GeologyProfile>(`/api/wells/${wellId}/lithology/profile`);
    return response.data;
  },
  async seedDemoLayers(wellId: string): Promise<{ message: string; count: number; layers: LithologyLayer[] }> {
    const response = await api.post<{ message: string; count: number; layers: LithologyLayer[] }>(`/api/wells/${wellId}/lithology/seed-demo`);
    return response.data;
  },
};

// ─── Geographic Hierarchy ─────────────────────────────────────────────────────
export const geoService = {
  async getCountries(): Promise<string[]> {
    const response = await api.get<string[]>('/api/geo/countries');
    return response.data;
  },
  async getStates(country?: string): Promise<string[]> {
    const response = await api.get<string[]>('/api/geo/states', {
      params: country ? { country } : {},
    });
    return response.data;
  },
  async getDistricts(state: string, country?: string): Promise<string[]> {
    const response = await api.get<string[]>('/api/geo/districts', {
      params: { state, ...(country ? { country } : {}) },
    });
    return response.data;
  },
  async getCities(district?: string, state?: string, country?: string): Promise<string[]> {
    const params: Record<string, string> = {};
    if (district && district.trim()) params.district = district.trim();
    if (state && state.trim()) params.state = state.trim();
    if (country && country.trim()) params.country = country.trim();
    const response = await api.get<string[]>('/api/geo/cities', { params });
    return response.data;
  },
  async getHierarchy(country?: string, state?: string) {
    const response = await api.get('/api/geo/hierarchy', {
      params: { ...(country ? { country } : {}), ...(state ? { state } : {}) },
    });
    return response.data;
  },
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  async login(username_or_email: string, password: string) {
    const response = await api.post('/api/auth/login', {
      username_or_email,
      password,
    });
    if (response.data?.token && typeof window !== 'undefined') {
      localStorage.setItem('sam_token', response.data.token);
      localStorage.setItem('sam_user', JSON.stringify(response.data.user));
      localStorage.setItem('aquasense_token', response.data.token);
      localStorage.setItem('aquasense_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  async signup(username: string, email: string, password: string, full_name?: string) {
    const response = await api.post('/api/auth/signup', {
      username,
      email,
      password,
      full_name,
    });
    if (response.data?.token && typeof window !== 'undefined') {
      localStorage.setItem('sam_token', response.data.token);
      localStorage.setItem('sam_user', JSON.stringify(response.data.user));
      localStorage.setItem('aquasense_token', response.data.token);
      localStorage.setItem('aquasense_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  async logout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sam_token');
        localStorage.removeItem('sam_user');
        localStorage.removeItem('aquasense_token');
        localStorage.removeItem('aquasense_user');
      }
    }
  },
  async me() {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  getCurrentUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('sam_user') || localStorage.getItem('aquasense_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(localStorage.getItem('sam_token') || localStorage.getItem('aquasense_token'));
  },
  async getSubadmins() {
    const response = await api.get('/api/auth/subadmins');
    return response.data;
  },
  async createSubadmin(data: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
  }) {
    const response = await api.post('/api/auth/subadmins', data);
    return response.data;
  },
  async deleteSubadmin(id: number) {
    const response = await api.delete(`/api/auth/subadmins/${id}`);
    return response.data;
  },
};

export function isMainAdmin(user: any): boolean {
  if (!user?.role) return false;
  const r = String(user.role).toUpperCase();
  return r === 'MAIN_ADMIN' || r === 'ADMIN' || r === 'SUPER_ADMIN';
}

export function isSubadmin(user: any): boolean {
  if (!user?.role) return false;
  return String(user.role).toUpperCase() === 'SUBADMIN';
}

export function canManageWell(user: any, well: any): boolean {
  if (!user) return false;
  if (isMainAdmin(user)) return true;
  if (!well) return false;
  return well.created_by != null && String(well.created_by) === String(user.id);
}

// ─── Location & Search ────────────────────────────────────────────────────────
export interface LocationSearchResult {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  type: 'CITY' | 'RIVER' | 'STATION' | 'COORDINATE';
}

export const locationService = {
  async reverseGeocode(lat: number, lon: number): Promise<SelectedLocation> {
    const response = await api.get<SelectedLocation>('/api/location/reverse', {
      params: { lat, lon },
    });
    return response.data;
  },
  async search(query: string): Promise<LocationSearchResult[]> {
    const response = await api.get<LocationSearchResult[]>('/api/location/search', {
      params: { q: query },
    });
    return response.data;
  },
};

// ─── Forecast ─────────────────────────────────────────────────────────────────
export const forecastService = {
  async getForecast(lat: number, lon: number, hours: number = 48) {
    const response = await api.get('/api/forecast', {
      params: { lat, lon, hours },
    });
    return response.data;
  },
};

// ─── Early-Warning & Risk Alerts ──────────────────────────────────────────────
export interface Alert {
  id: number;
  well_id: string;
  well_name?: string;
  alert_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  is_forecast: boolean;
  forecast_horizon_days?: number | null;
  metric: string;
  observed_value?: number | null;
  threshold_value?: number | null;
  unit: string;
  reason: string;
  recommended_action: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
  created_at: string;
  last_evaluated_at: string;
  resolved_at?: string | null;
}

export interface AlertSummary {
  total_active: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  forecast_alert_count: number;
  observed_alert_count: number;
  wells_affected: number;
  evaluated_at: string;
}

export const alertService = {
  async getAlerts(params?: {
    well_id?: string;
    status?: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED' | 'ALL';
    severity?: 'CRITICAL' | 'WARNING' | 'INFO';
    is_forecast?: boolean;
    limit?: number;
  }): Promise<Alert[]> {
    const response = await api.get<Alert[]>('/api/alerts', { params });
    return response.data;
  },
  async getAlertSummary(): Promise<AlertSummary> {
    const response = await api.get<AlertSummary>('/api/alerts/summary');
    return response.data;
  },
  async evaluateAlerts(well_id?: string): Promise<{ status: string; total_active_alerts: number; alerts: Alert[] }> {
    const response = await api.post('/api/alerts/evaluate', null, { params: well_id ? { well_id } : {} });
    return response.data;
  },
  async acknowledgeAlert(alert_id: number): Promise<Alert> {
    const response = await api.post<Alert>(`/api/alerts/${alert_id}/acknowledge`);
    return response.data;
  },
};

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthService = {
  async ping(): Promise<boolean> {
    try {
      await api.get('/');
      return true;
    } catch {
      return false;
    }
  },
};

export default api;

