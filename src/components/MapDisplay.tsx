'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { supabase } from '@/lib/supabaseClient';
import { MapPin, Navigation, Info } from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface MapDisplayProps {
  orderId?: string;
  driverId?: string;
  initialDriverLocation?: Coordinates | null;
  interactive?: boolean;
}

// MASP, São Paulo as default center
const DEFAULT_CENTER = {
  lat: -23.561486,
  lng: -46.657635
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '16px'
};

const darkMapOptions = {
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#f1f5f9' }]
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#38bdf8' }]
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#0f172a' }]
    },
    {
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#4ade80' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#334155' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#475569' }]
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#cbd5e1' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#1e293b' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#334155' }]
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0f172a' }]
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#475569' }]
    }
  ],
  disableDefaultUI: true,
  zoomControl: true,
};

export default function MapDisplay({ orderId, driverId, initialDriverLocation, interactive = false }: MapDisplayProps) {
  const [driverLocation, setDriverLocation] = useState<Coordinates>(initialDriverLocation || DEFAULT_CENTER);
  const [routeHistory, setRouteHistory] = useState<Coordinates[]>([initialDriverLocation || DEFAULT_CENTER]);

  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
  const isMockKey = !googleMapsKey || googleMapsKey.includes('YourGoogleMapsAPIKey');

  // 1. Carregar Google Maps API (apenas se a chave for válida)
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: isMockKey ? '' : googleMapsKey
  });

  // 2. Ouvinte de tempo real do Supabase
  useEffect(() => {
    if (initialDriverLocation) {
      setDriverLocation(initialDriverLocation);
      setRouteHistory([initialDriverLocation]);
    }
  }, [initialDriverLocation]);

  useEffect(() => {
    if (!orderId) return;

    // Buscar histórico de eventos de rastreamento existentes ao carregar
    const fetchExistingEvents = async () => {
      const { data, error } = await supabase
        .from('tracking_events')
        .select('location, recorded_at')
        .eq('order_id', orderId)
        .order('recorded_at', { ascending: true });

      if (data && data.length > 0) {
        const coords: Coordinates[] = data.map((event: any) => {
          const loc = event.location;
          if (typeof loc === 'string') {
            const match = loc.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            return match ? { lat: parseFloat(match[2]), lng: parseFloat(match[1]) } : DEFAULT_CENTER;
          } else if (loc && loc.coordinates) {
            return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
          }
          return DEFAULT_CENTER;
        });
        setRouteHistory(coords);
        setDriverLocation(coords[coords.length - 1]);
      }
    };

    fetchExistingEvents();

    const channel = supabase
      .channel(`tracking:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking_events',
          filter: `order_id=eq.${orderId}`
        },
        (payload: any) => {
          const location = payload.new.location;
          let lat = 0;
          let lng = 0;

          if (typeof location === 'string') {
            const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          } else if (location && location.coordinates) {
            lng = location.coordinates[0];
            lat = location.coordinates[1];
          }

          if (lat && lng) {
            const newCoord = { lat, lng };
            setDriverLocation(newCoord);
            setRouteHistory((prev) => [...prev, newCoord]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Se a API do Google Maps for carregada com sucesso e a chave for válida, renderiza o mapa real
  if (!isMockKey && isLoaded) {
    return (
      <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={driverLocation}
          zoom={16}
          options={darkMapOptions}
        >
          {/* Marcador do Motorista */}
          <Marker
            position={driverLocation}
            icon={{
              path: window.google?.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: '#0ea5e9',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
          {/* Linha de Trajetória */}
          <Polyline
            path={routeHistory}
            options={{
              strokeColor: '#38bdf8',
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        </GoogleMap>
      </div>
    );
  }

  // Fallback: Dashboard Visual Interativo em caso de chaves mockadas (Avenida Paulista)
  // Mapeia coordenadas reais de SP para posições relativas na tela (SVG)
  const getRelativePosition = (coord: Coordinates) => {
    // Escopo MASP (-23.561486, -46.657635) para Parque Trianon (-23.565486, -46.661635)
    const minLat = -23.5670;
    const maxLat = -23.5600;
    const minLng = -46.6630;
    const maxLng = -46.6550;

    const x = ((coord.lng - minLng) / (maxLng - minLng)) * 100;
    const y = 100 - (((coord.lat - minLat) / (maxLat - minLat)) * 100); // Inverte Y no SVG

    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y))
    };
  };

  const currentPos = getRelativePosition(driverLocation);

  return (
    <div className="w-full h-full relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col items-stretch">
      {/* Barra de Notificação Superior */}
      <div className="absolute top-4 left-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg">
        <Info className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div className="text-xs text-slate-300 leading-snug">
          <span className="font-semibold text-slate-100 block">Modo Simulação de Rota</span>
          Chave do Google Maps ausente no .env.local. Visualizando simulador interativo (Av. Paulista, SP).
        </div>
      </div>

      {/* SVG Canvas Map Display */}
      <div className="flex-grow relative flex items-center justify-center p-6 bg-grid-slate-900">
        <svg viewBox="0 0 100 100" className="w-full h-full max-h-[400px]" preserveAspectRatio="none">
          {/* Malha Urbana / Ruas Secundárias */}
          <line x1="10" y1="20" x2="90" y2="20" stroke="#1e293b" strokeWidth="1" strokeDasharray="2" />
          <line x1="10" y1="80" x2="90" y2="80" stroke="#1e293b" strokeWidth="1" strokeDasharray="2" />
          <line x1="30" y1="10" x2="30" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="2" />
          <line x1="70" y1="10" x2="70" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="2" />

          {/* Avenida Principal (Av. Paulista) */}
          <line x1="5" y1="50" x2="95" y2="50" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="#475569" strokeWidth="0.8" strokeDasharray="3,3" />

          {/* Parques / Pontos de Interesse */}
          <rect x="25" y="32" width="12" height="10" rx="2" fill="#065f46" fillOpacity="0.4" stroke="#059669" strokeWidth="0.5" />
          <text x="31" y="38" fill="#34d399" fontSize="2" fontWeight="bold" textAnchor="middle">MASP</text>

          <rect x="58" y="58" width="15" height="12" rx="2" fill="#065f46" fillOpacity="0.4" stroke="#059669" strokeWidth="0.5" />
          <text x="65.5" y="65" fill="#34d399" fontSize="2" fontWeight="bold" textAnchor="middle">Pq. Trianon</text>

          {/* Trajetória Percorrida */}
          {routeHistory.length > 1 && (
            <polyline
              points={routeHistory.map(c => {
                const p = getRelativePosition(c);
                return `${p.x},${p.y}`;
              }).join(' ')}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-pulse"
            />
          )}

          {/* Origem e Destino */}
          <circle cx="20" cy="50" r="2.5" fill="#10b981" />
          <circle cx="80" cy="50" r="2.5" fill="#ef4444" />

          {/* Motorista (Posição Atual) */}
          <g transform={`translate(${currentPos.x}, ${currentPos.y})`} className="transition-all duration-700 ease-out">
            <circle cx="0" cy="0" r="4.5" fill="#0ea5e9" fillOpacity="0.3" className="animate-ping" />
            <circle cx="0" cy="0" r="3" fill="#0ea5e9" stroke="#ffffff" strokeWidth="0.8" />
            <polygon points="-1,-1 0,-3 1,-1 0,-1.5" fill="#ffffff" transform="rotate(90)" />
          </g>
        </svg>

        {/* Info Box do Motorista Flutuante */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
            <Navigation className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Motorista GPS</div>
            <div className="text-xs font-mono text-slate-200">
              {driverLocation.lat.toFixed(5)}, {driverLocation.lng.toFixed(5)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
