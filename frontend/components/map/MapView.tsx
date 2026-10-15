'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-xl">
      <Skeleton className="w-full h-full rounded-xl" />
    </div>
  ),
});

interface MapViewProps {
  onLocationSelect: (lat: number, lon: number, name?: string) => void;
  selectedLat?: number | null;
  selectedLon?: number | null;
  filterParams?: {
    country?: string;
    state?: string;
    district?: string;
    city?: string;
  };
  onFilteredWellsCountChange?: (count: number) => void;
  onResetFilter?: () => void;
  onViewWellDetails?: (wellId: string) => void;
}

export function MapView({
  onLocationSelect,
  selectedLat,
  selectedLon,
  filterParams,
  onFilteredWellsCountChange,
  onResetFilter,
  onViewWellDetails,
}: MapViewProps) {
  return (
    <div className="w-full h-[500px] lg:h-[540px] rounded-xl overflow-hidden border shadow-sm">
      <MapComponent
        onLocationSelect={onLocationSelect}
        selectedLat={selectedLat}
        selectedLon={selectedLon}
        filterParams={filterParams}
        onFilteredWellsCountChange={onFilteredWellsCountChange}
        onResetFilter={onResetFilter}
        onViewWellDetails={onViewWellDetails}
      />
    </div>
  );
}
