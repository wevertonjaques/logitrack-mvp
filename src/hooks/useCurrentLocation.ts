'use client';

import { useState, useEffect } from 'react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationState {
  coordinates: Coordinates | null;
  error: string | null;
}

export function useCurrentLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    coordinates: null,
    error: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState({
        coordinates: null,
        error: 'Geolocalização não é suportada pelo seu navegador.',
      });
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        coordinates: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        error: null,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'Ocorreu um erro desconhecido ao obter a geolocalização.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permissão de geolocalização negada pelo usuário.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'As informações de localização estão indisponíveis.';
          break;
        case error.TIMEOUT:
          errorMessage = 'A requisição para obter a localização expirou.';
          break;
      }
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    };

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return state;
}
