// Supported city centers for autocomplete search radius.
// When the user has a known location (origin, location pin, or saved place),
// we snap the autocomplete search center to the nearest city below so that
// destination/origin suggestions stay locally relevant.

export interface CityCenter {
  name: string;
  lat: number;
  lon: number;
}

export const SUPPORTED_CITIES: CityCenter[] = [
  // Karnataka
  { name: 'Bangalore',      lat: 12.9716, lon: 77.5946 },
  { name: 'Mysore',         lat: 12.2958, lon: 76.6394 },
  { name: 'Tumakuru',       lat: 13.3409, lon: 77.1010 },
  { name: 'Hubli',          lat: 15.3647, lon: 75.1240 },
  { name: 'Mangalore',      lat: 12.9141, lon: 74.8560 },
  { name: 'Udupi',          lat: 13.3409, lon: 74.7421 },
  { name: 'Davanagere',     lat: 14.4644, lon: 75.9218 },
  { name: 'Shivamogga',     lat: 13.9299, lon: 75.5681 },
  { name: 'Gulbarga',       lat: 17.3297, lon: 76.8343 },
  { name: 'Bidar',          lat: 17.9133, lon: 77.5301 },
  { name: 'Ballari',        lat: 15.1394, lon: 76.9214 },

  // Tamil Nadu
  { name: 'Chennai',        lat: 13.0827, lon: 80.2707 },
  { name: 'Coimbatore',     lat: 11.0168, lon: 76.9558 },
  { name: 'Madurai',        lat: 9.9252,  lon: 78.1198 },
  { name: 'Salem',          lat: 11.6643, lon: 78.1460 },
  { name: 'Hosur',          lat: 12.7409, lon: 77.8253 },
  { name: 'Trichy',         lat: 10.7905, lon: 78.7047 },
  { name: 'Tirunelveli',    lat: 8.7139,  lon: 77.7567 },
  { name: 'Thanjavur',      lat: 10.7870, lon: 79.1378 },
  { name: 'Vellore',        lat: 12.9165, lon: 79.1325 },
  { name: 'Pudukkottai',    lat: 10.3833, lon: 78.8001 },
  { name: 'Mayiladuthurai', lat: 11.1018, lon: 79.6515 },

  // Telangana
  { name: 'Hyderabad',      lat: 17.3850, lon: 78.4867 },
  { name: 'Warangal',       lat: 17.9689, lon: 79.5941 },
  { name: 'Khammam',        lat: 17.2473, lon: 80.1514 },
  { name: 'Karimnagar',     lat: 18.4386, lon: 79.1288 },
  { name: 'Nizamabad',      lat: 18.6725, lon: 78.0941 },
  { name: 'Mahbubnagar',    lat: 16.7393, lon: 77.9974 },
  { name: 'Suryapet',       lat: 17.1346, lon: 79.6228 },
  { name: 'Nalgonda',       lat: 17.0542, lon: 79.2671 },
  { name: 'Siddipet',       lat: 18.1018, lon: 78.8474 },

  // Andhra Pradesh
  { name: 'Vijayawada',     lat: 16.5062, lon: 80.6480 },
  { name: 'Vishakapatnam',  lat: 17.6868, lon: 83.2185 },
  { name: 'Guntur',         lat: 16.3067, lon: 80.4365 },
  { name: 'Tirupati',       lat: 13.6288, lon: 79.4192 },
  { name: 'Kurnool',        lat: 15.8281, lon: 78.0373 },

  // Kerala
  { name: 'Kochi',          lat: 9.9312,  lon: 76.2673 },
  { name: 'Trivandrum',     lat: 8.5241,  lon: 76.9366 },
  { name: 'Thrissur',       lat: 10.5276, lon: 76.2144 },
  { name: 'Kozhikode',      lat: 11.2588, lon: 75.7804 },
  { name: 'Alapuzha',       lat: 9.4981,  lon: 76.3388 },
  { name: 'Idukki',         lat: 9.8497,  lon: 76.9700 },
  { name: 'Kasaragod',      lat: 12.4996, lon: 74.9869 },
  { name: 'Wayanad',        lat: 11.6854, lon: 76.1320 },
  { name: 'Kannur',         lat: 11.8745, lon: 75.3704 },
  { name: 'Kottayam',       lat: 9.5916,  lon: 76.5222 },
  { name: 'Palakkad',       lat: 10.7867, lon: 76.6548 },
  { name: 'Kollam',         lat: 8.8932,  lon: 76.6141 },
  { name: 'Pathanamthitta', lat: 9.2648,  lon: 76.7870 },
  { name: 'Malappuram',     lat: 11.0510, lon: 76.0711 },

  // West Bengal
  { name: 'Kolkata',        lat: 22.5726, lon: 88.3639 },
  { name: 'Siliguri',       lat: 26.7271, lon: 88.3953 },
  { name: 'Asansol',        lat: 23.6889, lon: 86.9661 },
  { name: 'Durgapur',       lat: 23.5204, lon: 87.3119 },
  { name: 'Petrapole',      lat: 23.0070, lon: 88.7980 },
  { name: 'Darjeeling',     lat: 27.0360, lon: 88.2627 },
  { name: 'Bardhaman',      lat: 23.2324, lon: 87.8615 },
  { name: 'PurbaBardhaman', lat: 23.2324, lon: 87.8615 },
  { name: 'Birbhum',        lat: 23.8408, lon: 87.6193 },
  { name: 'Bankura',        lat: 23.2480, lon: 87.0680 },
  { name: 'Digha',          lat: 21.6276, lon: 87.5089 },

  // Odisha
  { name: 'Bhubaneshwar',   lat: 20.2961, lon: 85.8245 },
  { name: 'Cuttack',        lat: 20.4625, lon: 85.8830 },
  { name: 'Puri',           lat: 19.8135, lon: 85.8312 },
  { name: 'Rourkela',       lat: 22.2604, lon: 84.8536 },
  { name: 'Berhampur',      lat: 19.3149, lon: 84.7941 },
  { name: 'Jharsuguda',     lat: 21.8554, lon: 84.0062 },
  { name: 'Sambalpur',      lat: 21.4669, lon: 83.9756 },

  // Maharashtra
  { name: 'Mumbai',         lat: 19.0760, lon: 72.8777 },
  { name: 'Pune',           lat: 18.5204, lon: 73.8567 },

  // Gujarat
  { name: 'Ahmedabad',      lat: 23.0225, lon: 72.5714 },
  { name: 'Surat',          lat: 21.1702, lon: 72.8311 },
  { name: 'Vadodara',       lat: 22.3072, lon: 73.1812 },
  { name: 'Rajkot',         lat: 22.3039, lon: 70.8022 },
  { name: 'Jamnagar',       lat: 22.4707, lon: 70.0577 },
  { name: 'Somnath',        lat: 20.8880, lon: 70.4011 },
  { name: 'Dwarka',         lat: 22.2442, lon: 68.9685 },

  // North India
  { name: 'Delhi',          lat: 28.6139, lon: 77.2090 },
  { name: 'Noida',          lat: 28.5355, lon: 77.3910 },
  { name: 'Gurugram',       lat: 28.4595, lon: 77.0266 },
  { name: 'Chandigarh',     lat: 30.7333, lon: 76.7794 },
  { name: 'Jaipur',         lat: 26.9124, lon: 75.7873 },

  // Jammu & Kashmir
  { name: 'Srinagar',       lat: 34.0837, lon: 74.7973 },
  { name: 'Pulwama',        lat: 33.8716, lon: 74.8949 },
  { name: 'Jammu',          lat: 32.7266, lon: 74.8570 },
  { name: 'Anantnag',       lat: 33.7311, lon: 75.1487 },

  // Northeast & Sikkim
  { name: 'Gangtok',        lat: 27.3389, lon: 88.6065 },
  { name: 'Shillong',       lat: 25.5788, lon: 91.8933 },
  { name: 'Cherrapunji',    lat: 25.2702, lon: 91.7323 },

  // Pondicherry
  { name: 'Pondicherry',    lat: 11.9416, lon: 79.8083 },

];

// Default fallback when no location context is available.
export const DEFAULT_CITY: CityCenter = SUPPORTED_CITIES[0];

// Search radius (meters) — 50 km covers most metro areas including outskirts.
export const CITY_SEARCH_RADIUS_METERS = 50000;

// Haversine distance in kilometers between two lat/lon points.
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Returns the supported city closest to the given coordinates.
// If the nearest city is more than `maxKm` away (default 200), returns the
// default city instead — this avoids snapping a user in an unsupported region
// to a far-away city which would only confuse autocomplete results.
export function findNearestCity(
  lat: number,
  lon: number,
  maxKm = 200,
): CityCenter {
  let nearest = DEFAULT_CITY;
  let nearestDist = Infinity;
  for (const city of SUPPORTED_CITIES) {
    const d = haversineKm(lat, lon, city.lat, city.lon);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = city;
    }
  }
  return nearestDist <= maxKm ? nearest : DEFAULT_CITY;
}
