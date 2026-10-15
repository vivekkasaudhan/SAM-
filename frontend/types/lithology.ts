export type MaterialType =
  | 'topsoil'
  | 'clay'
  | 'sand'
  | 'gravel'
  | 'silt'
  | 'sandstone'
  | 'limestone'
  | 'granite'
  | 'weathered_rock'
  | 'fractured_rock'
  | 'other';

export type DataSourceType =
  | 'CORE_SAMPLE'
  | 'DRILL_CUTTINGS'
  | 'GEOPHYSICAL_LOG'
  | 'HISTORICAL_RECORD'
  | 'FIELD_OBSERVATION'
  | 'ESTIMATED'
  | 'illustrative_demo'
  | string;

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LithologyLayer {
  id: number;
  well_id: string;
  from_depth_m: number;
  to_depth_m: number;
  thickness_m: number;
  material_type: string;
  description?: string | null;
  color_code?: string | null;
  observed_properties?: Record<string, any> | null;
  data_source: DataSourceType;
  confidence_level: ConfidenceLevel;
  aquifer_indicator: boolean;
  source_reference?: string | null;
  attachment_url?: string | null;
  created_by_user_id?: number | null;
  updated_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
  creator_name?: string | null;
}

export interface DepthGap {
  from_depth_m: number;
  to_depth_m: number;
  length_m: number;
}

export interface GeologyProfile {
  well_id: string;
  well_name: string;
  well_total_depth_m?: number | null;
  total_logged_depth_m: number;
  layer_count: number;
  aquifer_layers_count: number;
  has_aquifer_layer: boolean;
  depth_coverage_pct: number;
  logged_thickness_m: number;
  gaps: DepthGap[];
  dominant_material?: string | null;
  data_confidence_summary: Record<string, number>;
  stratigraphic_column: LithologyLayer[];
}

export const MATERIAL_METADATA: Record<
  string,
  { label: string; defaultColor: string; texture: string; description: string }
> = {
  topsoil: {
    label: 'Topsoil (Organic Humus)',
    defaultColor: '#4A3525',
    texture: 'radial-dots',
    description: 'Surface dark organic-rich loam containing plant roots and decomposing humus.',
  },
  clay: {
    label: 'Plastic Clay',
    defaultColor: '#8B5A2B',
    texture: 'horizontal-stripes',
    description: 'Cohesive, fine-grained aquitard with very low hydraulic conductivity.',
  },
  sand: {
    label: 'Porous Sand',
    defaultColor: '#E6C280',
    texture: 'fine-stipple',
    description: 'Medium-to-coarse quartz grains with high porosity and groundwater transmission.',
  },
  gravel: {
    label: 'Gravel & Pebbles',
    defaultColor: '#A89F91',
    texture: 'pebbles',
    description: 'Coarse sub-rounded alluvial pebbles forming high-yield aquifer horizons.',
  },
  silt: {
    label: 'Inorganic Silt',
    defaultColor: '#C2B280',
    texture: 'fine-horizontal',
    description: 'Micro-granular transitional sediment with moderate-to-low permeability.',
  },
  sandstone: {
    label: 'Consolidated Sandstone',
    defaultColor: '#D4A373',
    texture: 'bedding-lines',
    description: 'Sedimentary bedrock with intergranular pore space capable of aquifer storage.',
  },
  limestone: {
    label: 'Karstic Limestone',
    defaultColor: '#E9D8A6',
    texture: 'brick-pattern',
    description: 'Carbonate rock with solution channels and localized groundwater storage.',
  },
  granite: {
    label: 'Crystalline Granite',
    defaultColor: '#70757A',
    texture: 'cross-hatch',
    description: 'Dense plutonic basement bedrock; impermeable except along tectonic fissures.',
  },
  weathered_rock: {
    label: 'Weathered Rock (Saprolite)',
    defaultColor: '#9C6644',
    texture: 'irregular-patches',
    description: 'Decomposed in-situ basement rock forming shallow unconfined storage zones.',
  },
  fractured_rock: {
    label: 'Fractured Hard Rock',
    defaultColor: '#4F5D75',
    texture: 'diagonal-fractures',
    description: 'Jointed and faulted crystalline rock with secondary fracture-network porosity.',
  },
  other: {
    label: 'Undifferentiated Strata',
    defaultColor: '#94A3B8',
    texture: 'solid',
    description: 'Miscellaneous or unidentified geological formations.',
  },
};

export const DATA_SOURCE_BADGES: Record<
  string,
  { label: string; variant: 'live' | 'verified' | 'estimated' | 'demo'; verified: boolean }
> = {
  CORE_SAMPLE: { label: 'Borehole Core Sample', variant: 'verified', verified: true },
  DRILL_CUTTINGS: { label: 'Drilling Log / Cuttings', variant: 'verified', verified: true },
  GEOPHYSICAL_LOG: { label: 'Geophysical Well Log', variant: 'verified', verified: true },
  HISTORICAL_RECORD: { label: 'Historical Geological Report', variant: 'verified', verified: true },
  FIELD_OBSERVATION: { label: 'Field Observation', variant: 'verified', verified: true },
  ESTIMATED: { label: 'Estimated Stratigraphy', variant: 'estimated', verified: false },
  illustrative_demo: { label: 'Illustrative Demo Strata', variant: 'demo', verified: false },
};

export function getMaterialLabel(type: string): string {
  const meta = MATERIAL_METADATA[type.toLowerCase()];
  return meta ? meta.label : type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getMaterialColor(type: string, customColor?: string | null): string {
  if (customColor && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(customColor)) {
    return customColor;
  }
  const meta = MATERIAL_METADATA[type.toLowerCase()];
  return meta ? meta.defaultColor : '#94A3B8';
}
