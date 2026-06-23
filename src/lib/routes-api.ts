const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

interface RouteEstimate {
  distance_km: number;
  duration_hours: number;
  tolls_estimate: number;
  fuel_liters_estimate: number;
  fuel_cost_estimate: number;
  total_cost_estimate: number;
}

interface RouteRequest {
  origin: string;
  destination: string;
  axles_count: number;
  fuel_efficiency: number;
  diesel_price: number;
}

export async function calculateRoute(params: RouteRequest): Promise<RouteEstimate | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.tolls',
      },
      body: JSON.stringify({
        origin: {
          address: params.origin,
        },
        destination: {
          address: params.destination,
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          vehicleInfo: {
            emissionType: 'DIESEL',
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Routes API error:', errorData);
      return null;
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const distanceMeters = parseInt(route.distanceMeters) || 0;
    const durationSeconds = parseInt(route.duration?.replace('s', '')) || 0;

    const distanceKm = distanceMeters / 1000;
    const durationHours = durationSeconds / 3600;

    const fuelLiters = distanceKm / params.fuel_efficiency;
    const fuelCost = fuelLiters * params.diesel_price;

    const tollsEstimate = calculateTollEstimate(distanceKm, params.axles_count);
    const totalCost = fuelCost + tollsEstimate;

    return {
      distance_km: distanceKm,
      duration_hours: durationHours,
      tolls_estimate: tollsEstimate,
      fuel_liters_estimate: fuelLiters,
      fuel_cost_estimate: fuelCost,
      total_cost_estimate: totalCost,
    };
  } catch (error) {
    console.error('Error calculating route:', error);
    return null;
  }
}

function calculateTollEstimate(distanceKm: number, axlesCount: number): number {
  const averageTollRate = 0.15 * axlesCount;
  const estimatedTollsCount = Math.floor(distanceKm / 150);
  return estimatedTollsCount * averageTollRate * 100;
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}
