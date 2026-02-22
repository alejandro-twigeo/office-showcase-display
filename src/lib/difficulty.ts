export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};

/** Bbox size in degrees around a seed point for each difficulty */
export const DIFFICULTY_BBOX_SIZE: Record<Difficulty, number> = {
  1: 0.05,  // ~5 km radius – tight around major cities
  2: 0.3,   // ~30 km radius – populated areas
  3: 1.5,   // ~150 km radius – remote / obscure
};

/**
 * Major-city seed coordinates for Easy mode.
 * Medium picks random populated-continent coords.
 * Hard picks fully random land coords.
 */
export const MAJOR_CITY_COORDS: [number, number][] = [
  [48.8566, 2.3522],   // Paris
  [40.7128, -74.006],  // New York
  [35.6762, 139.6503], // Tokyo
  [51.5074, -0.1278],  // London
  [-33.8688, 151.2093],// Sydney
  [52.52, 13.405],     // Berlin
  [41.9028, 12.4964],  // Rome
  [40.4168, -3.7038],  // Madrid
  [55.7558, 37.6173],  // Moscow
  [39.9042, 116.4074], // Beijing
  [37.5665, 126.978],  // Seoul
  [13.7563, 100.5018], // Bangkok
  [-22.9068, -43.1729],// Rio de Janeiro
  [34.0522, -118.2437],// Los Angeles
  [43.6532, -79.3832], // Toronto
  [19.4326, -99.1332], // Mexico City
  [28.6139, 77.209],   // New Delhi
  [1.3521, 103.8198],  // Singapore
  [31.2304, 121.4737], // Shanghai
  [59.3293, 18.0686],  // Stockholm
  [50.0755, 14.4378],  // Prague
  [47.4979, 19.0402],  // Budapest
  [38.7223, -9.1393],  // Lisbon
  [37.9838, 23.7275],  // Athens
  [41.0082, 28.9784],  // Istanbul
  [33.8886, 35.4955],  // Beirut
  [-34.6037, -58.3816],// Buenos Aires
  [45.4642, 9.19],     // Milan
  [48.2082, 16.3738],  // Vienna
  [35.6892, 51.389],   // Tehran
  [6.5244, 3.3792],    // Lagos
  [-1.2921, 36.8219],  // Nairobi
  [14.5995, 120.9842], // Manila
  [21.0278, 105.8342], // Hanoi
  [30.0444, 31.2357],  // Cairo
  [25.2048, 55.2708],  // Dubai
  [-23.5505, -46.6333],// São Paulo
  [45.815, 15.9819],   // Zagreb
  [42.6977, 23.3219],  // Sofia
  [44.4268, 26.1025],  // Bucharest
];

/** Continent bounding boxes for Medium: [south, north, west, east] */
export const CONTINENT_BOUNDS: [number, number, number, number][] = [
  [36, 60, -10, 40],    // Europe
  [25, 50, 60, 130],    // Asia (populated)
  [-35, 5, 15, 50],     // Africa (east)
  [5, 50, -130, -60],   // North America
  [-40, 5, -80, -35],   // South America
  [-40, -10, 115, 155], // Australia
];

/** Pick a random seed coordinate for the given difficulty */
export function getRandomSeed(difficulty: Difficulty): { lat: number; lng: number } {
  if (difficulty === 1) {
    const city = MAJOR_CITY_COORDS[Math.floor(Math.random() * MAJOR_CITY_COORDS.length)];
    return { lat: city[0], lng: city[1] };
  }

  if (difficulty === 2) {
    const bounds = CONTINENT_BOUNDS[Math.floor(Math.random() * CONTINENT_BOUNDS.length)];
    return {
      lat: bounds[0] + Math.random() * (bounds[1] - bounds[0]),
      lng: bounds[2] + Math.random() * (bounds[3] - bounds[2]),
    };
  }

  // Hard: random land-ish coordinates (avoid open ocean)
  // Simple heuristic: weighted towards land latitudes
  const regions: [number, number, number, number][] = [
    [35, 65, -10, 60],    // Europe/Central Asia
    [10, 45, 60, 140],    // Asia
    [-35, 15, 10, 50],    // Africa
    [10, 55, -130, -60],  // North America
    [-55, 10, -80, -35],  // South America
    [-45, -10, 110, 175], // Oceania
  ];
  const region = regions[Math.floor(Math.random() * regions.length)];
  return {
    lat: region[0] + Math.random() * (region[1] - region[0]),
    lng: region[2] + Math.random() * (region[3] - region[2]),
  };
}

/** Build a bbox [west, south, east, north] around a seed */
export function seedToBbox(
  seed: { lat: number; lng: number },
  halfSize: number
): [number, number, number, number] {
  return [
    seed.lng - halfSize,
    seed.lat - halfSize,
    seed.lng + halfSize,
    seed.lat + halfSize,
  ];
}
