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
    const token = localStorage.getItem('aquasense_token');
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

export const wellService = {
  async getWells(filters?: {
    country?: string;
    state?: string;
    district?: string;
    city?: string;
    is_active?: boolean;
    subadmin_id?: number | string;
    created_by?: number | string;
  }) {
    const response = await api.get('/api/wells', { params: filters });
    return response.data;
  },
  async getWell(id: string) {
    const response = await api.get(`/api/wells/${id}`);
    return response.data;
  },
  async getWellReadings(id: string, limit: number = 50) {
    const response = await api.get(`/api/wells/${id}/readings`, { params: { limit } });
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
    const raw = localStorage.getItem('aquasense_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('aquasense_token');
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
