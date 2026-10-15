'use client';

import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createLocationPinIcon(color = '#0284c7', emoji = '📍', size = 34) {
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="transform:rotate(45deg);font-size:${size * 0.45}px;line-height:1;">${emoji}</div>
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

const PIN_ICON = createLocationPinIcon('#0ea5e9', '🚰', 36);

interface LocationPickerMapProps {
  lat: number;
  lon: number;
  onLocationChange: (lat: number, lon: number) => void;
}

function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);
  return null;
}

export default function LocationPickerMap({
  lat,
  lon,
  onLocationChange,
}: LocationPickerMapProps) {
  const position = useMemo(() => [lat, lon] as [number, number], [lat, lon]);

  const eventHandlers = useMemo(
    () => ({
      dragend(e: any) {
        const marker = e.target;
        if (marker) {
          const latlng = marker.getLatLng();
          onLocationChange(Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6)));
        }
      },
    }),
    [onLocationChange]
  );

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border shadow-inner">
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onLocationChange={onLocationChange} />
        <RecenterMap lat={lat} lon={lon} />
        <Marker
          draggable={true}
          eventHandlers={eventHandlers}
          position={position}
          icon={PIN_ICON}
        />
      </MapContainer>
    </div>
  );
}
