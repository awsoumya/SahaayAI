import express from 'express';
import multer from 'multer';
import { analyzeSanitationIssue } from './gemini.js';
import { performVerification, identifyAuthority, MUNICIPAL_AUTHORITIES } from './verification.js';
import { db } from './db.js';

export const router = express.Router();

// Configure Multer for secure, in-memory image & audio upload handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit for media
    files: 2
  },
  fileFilter: (req, file, cb) => {
    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedAudioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a', 'audio/m4a'];

    if (file.fieldname === 'image') {
      if (allowedImageMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`));
      }
    } else if (file.fieldname === 'audio') {
      if (allowedAudioMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported audio type: ${file.mimetype}. Allowed: MP3, WAV, WebM, OGG, M4A.`));
      }
    } else {
      cb(null, true);
    }
  }
});

// Middleware for input sanitization & rate limiting
const requestCounts = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 60;

  const userRecord = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > userRecord.resetTime) {
    userRecord.count = 1;
    userRecord.resetTime = now + windowMs;
  } else {
    userRecord.count += 1;
  }

  requestCounts.set(ip, userRecord);

  if (userRecord.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please wait a moment before submitting further requests.'
    });
  }

  next();
}

router.use(rateLimiter);

/**
 * GET /api/health
 */
router.get('/health', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    status: 'healthy',
    app: 'Sahaay AI Backend',
    gemini: {
      configured: hasKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      mode: hasKey ? 'live_api' : 'demonstration_fallback'
    },
    features: {
      bilingual_complaints: true,
      reverse_geocoding: true,
      audio_upload: true,
      resolution_verification: true
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/authorities
 * Returns authoritative directory of Indian municipal corporations
 */
router.get('/authorities', (req, res) => {
  res.json({
    success: true,
    data: Object.values(MUNICIPAL_AUTHORITIES)
  });
});

/**
 * GET /api/reverse-geocode
 * Resolves GPS Coordinates to Real Street, Area, City & Postcode
 */
router.get('/reverse-geocode', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ success: false, error: 'Valid lat and lon query parameters are required.' });
  }

  try {
    // Attempt OpenStreetMap Nominatim with fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
    const geoRes = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'SahaayAI-Civic-App/1.0 (contact@sahaay.org)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (geoRes.ok) {
      const geoJson = await geoRes.json();
      const addr = geoJson.address || {};

      const city = addr.city || addr.town || addr.municipality || addr.state_district || 'Bengaluru';
      const neighborhood = addr.suburb || addr.neighbourhood || addr.residential || '';
      const road = addr.road || addr.street || '';
      const postcode = addr.postcode || '';

      return res.json({
        success: true,
        data: {
          city,
          neighborhood,
          landmark: road ? `${road}${neighborhood ? ', ' + neighborhood : ''}` : neighborhood,
          address: geoJson.display_name || `${road}, ${neighborhood}, ${city} ${postcode}`.trim(),
          postcode,
          coordinates: { lat, lon }
        }
      });
    }
  } catch (err) {
    // Network/timeout fallback to coordinate bounding box heuristics for Indian Metros
  }

  // Fallback heuristic for coordinates within major Indian city bounding boxes
  let detectedCity = 'Bengaluru';
  let detectedArea = 'HAL 2nd Stage';

  if (lat >= 12.8 && lat <= 13.2 && lon >= 77.4 && lon <= 77.8) {
    detectedCity = 'Bengaluru';
    detectedArea = 'Indiranagar / East Zone';
  } else if (lat >= 28.4 && lat <= 28.9 && lon >= 76.8 && lon <= 77.4) {
    detectedCity = 'New Delhi';
    detectedArea = 'Dwarka / South Zone';
  } else if (lat >= 18.8 && lat <= 19.3 && lon >= 72.7 && lon <= 73.1) {
    detectedCity = 'Mumbai';
    detectedArea = 'Andheri West / K-West Ward';
  } else if (lat >= 12.9 && lat <= 13.3 && lon >= 80.1 && lon <= 80.4) {
    detectedCity = 'Chennai';
    detectedArea = 'Adyar / Zone 13';
  } else if (lat >= 17.2 && lat <= 17.6 && lon >= 78.2 && lon <= 78.6) {
    detectedCity = 'Hyderabad';
    detectedArea = 'Secunderabad / GHMC';
  }

  return res.json({
    success: true,
    data: {
      city: detectedCity,
      neighborhood: detectedArea,
      landmark: `Near GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
      address: `${detectedArea}, ${detectedCity}`,
      coordinates: { lat, lon }
    }
  });
});

/**
 * Pre-indexed high-speed directory of Indian localities, wards, and metropolitan areas.
 * Guarantees instantaneous, zero-latency autocomplete across all major Indian zones.
 */
const INDIAN_LOCALITIES_INDEX = [
  // Delhi NCR
  { name: 'Dwarka Sector 12', city: 'New Delhi', state: 'Delhi', pincode: '110075', lat: 28.5921, lon: 77.0460, ward: 'Ward 43 (Najafgarh Zone)', authority_key: 'delhi' },
  { name: 'Lajpat Nagar Central Market', city: 'New Delhi', state: 'Delhi', pincode: '110024', lat: 28.5683, lon: 77.2435, ward: 'Ward 58 (Central Zone)', authority_key: 'delhi' },
  { name: 'Connaught Place / Rajiv Chowk', city: 'New Delhi', state: 'Delhi', pincode: '110001', lat: 28.6304, lon: 77.2177, ward: 'NDMC Central Area', authority_key: 'delhi' },
  { name: 'Rohini Sector 7', city: 'New Delhi', state: 'Delhi', pincode: '110085', lat: 28.7112, lon: 77.1215, ward: 'Ward 22 (Rohini Zone)', authority_key: 'delhi' },
  { name: 'Chandni Chowk / Nai Sarak', city: 'New Delhi', state: 'Delhi', pincode: '110006', lat: 28.6562, lon: 77.2301, ward: 'Ward 81 (City-SP Zone)', authority_key: 'delhi' },
  { name: 'Saket / Select Citywalk', city: 'New Delhi', state: 'Delhi', pincode: '110017', lat: 28.5284, lon: 77.2185, ward: 'Ward 67 (South Zone)', authority_key: 'delhi' },
  { name: 'Karol Bagh Market', city: 'New Delhi', state: 'Delhi', pincode: '110005', lat: 28.6514, lon: 77.1907, ward: 'Ward 84 (Karol Bagh Zone)', authority_key: 'delhi' },
  { name: 'Hauz Khas Village', city: 'New Delhi', state: 'Delhi', pincode: '110016', lat: 28.5494, lon: 77.1960, ward: 'Ward 62 (South Zone)', authority_key: 'delhi' },
  { name: 'Mayur Vihar Phase 1', city: 'New Delhi', state: 'Delhi', pincode: '110091', lat: 28.6095, lon: 77.2942, ward: 'Ward 10 (East Zone)', authority_key: 'delhi' },
  { name: 'Sector 18 Market, Noida', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301', lat: 28.5708, lon: 77.3260, ward: 'Noida Authority Sector 18', authority_key: 'delhi' },
  { name: 'Cyber City, Gurugram', city: 'Gurugram', state: 'Haryana', pincode: '122002', lat: 28.4950, lon: 77.0895, ward: 'MCG Ward 32', authority_key: 'delhi' },

  // Mumbai
  { name: 'Andheri West (Lokhandwala)', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', lat: 19.1416, lon: 72.8256, ward: 'Ward 64 (K-West Ward)', authority_key: 'mumbai' },
  { name: 'Bandra West (Hill Road & Linking Rd)', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', lat: 19.0538, lon: 72.8285, ward: 'Ward 98 (H-West Ward)', authority_key: 'mumbai' },
  { name: 'Dadar West (Flower Market)', city: 'Mumbai', state: 'Maharashtra', pincode: '400028', lat: 19.0178, lon: 72.8478, ward: 'Ward 188 (G-North Ward)', authority_key: 'mumbai' },
  { name: 'Bandra Kurla Complex (BKC)', city: 'Mumbai', state: 'Maharashtra', pincode: '400051', lat: 19.0657, lon: 72.8687, ward: 'H-East Ward / MMRDA', authority_key: 'mumbai' },
  { name: 'Colaba Causeway', city: 'Mumbai', state: 'Maharashtra', pincode: '400005', lat: 18.9067, lon: 72.8147, ward: 'Ward 227 (A Ward)', authority_key: 'mumbai' },
  { name: 'Powai (Hiranandani)', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', lat: 19.1176, lon: 72.9060, ward: 'Ward 118 (S Ward)', authority_key: 'mumbai' },
  { name: 'Borivali West (IC Colony)', city: 'Mumbai', state: 'Maharashtra', pincode: '400092', lat: 19.2307, lon: 72.8567, ward: 'Ward 8 (R-Central Ward)', authority_key: 'mumbai' },
  { name: 'Chembur (Diamond Garden)', city: 'Mumbai', state: 'Maharashtra', pincode: '400071', lat: 19.0522, lon: 72.8994, ward: 'Ward 152 (M-West Ward)', authority_key: 'mumbai' },
  { name: 'Vashi Sector 17, Navi Mumbai', city: 'Navi Mumbai', state: 'Maharashtra', pincode: '400703', lat: 19.0771, lon: 72.9986, ward: 'NMMC Vashi Ward', authority_key: 'mumbai' },
  { name: 'Thane West (Panchpakhadi)', city: 'Thane', state: 'Maharashtra', pincode: '400602', lat: 19.1970, lon: 72.9636, ward: 'TMC Naupada Ward', authority_key: 'mumbai' },

  // Bengaluru
  { name: 'Indiranagar 12th Main', city: 'Bengaluru', state: 'Karnataka', pincode: '560038', lat: 12.9719, lon: 77.6412, ward: 'Ward 89 (Jogupalya)', authority_key: 'bengaluru' },
  { name: 'Koramangala 5th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', lat: 12.9352, lon: 77.6245, ward: 'Ward 151 (Koramangala)', authority_key: 'bengaluru' },
  { name: 'Whitefield (Hope Farm Junction)', city: 'Bengaluru', state: 'Karnataka', pincode: '560066', lat: 12.9845, lon: 77.7499, ward: 'Ward 84 (Whitefield)', authority_key: 'bengaluru' },
  { name: 'HSR Layout Sector 2', city: 'Bengaluru', state: 'Karnataka', pincode: '560102', lat: 12.9121, lon: 77.6446, ward: 'Ward 174 (HSR Layout)', authority_key: 'bengaluru' },
  { name: 'Jayanagar 4th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560011', lat: 12.9299, lon: 77.5833, ward: 'Ward 169 (Byrasandra)', authority_key: 'bengaluru' },
  { name: 'Malleshwaram 8th Cross', city: 'Bengaluru', state: 'Karnataka', pincode: '560003', lat: 13.0035, lon: 77.5707, ward: 'Ward 45 (Malleshwaram)', authority_key: 'bengaluru' },
  { name: 'MG Road / Brigade Road Junction', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', lat: 12.9756, lon: 77.6066, ward: 'Ward 111 (Shantala Nagar)', authority_key: 'bengaluru' },
  { name: 'Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560100', lat: 12.8452, lon: 77.6602, ward: 'ELCITA / Anekal Ward', authority_key: 'bengaluru' },
  { name: 'Marathahalli Bridge', city: 'Bengaluru', state: 'Karnataka', pincode: '560037', lat: 12.9591, lon: 77.7011, ward: 'Ward 85 (Doddanekkundi)', authority_key: 'bengaluru' },
  { name: 'Hebbal Flyover Junction', city: 'Bengaluru', state: 'Karnataka', pincode: '560024', lat: 13.0358, lon: 77.5970, ward: 'Ward 7 (Hebbal)', authority_key: 'bengaluru' },

  // Chennai
  { name: 'Adyar (Gandhi Nagar)', city: 'Chennai', state: 'Tamil Nadu', pincode: '600020', lat: 13.0067, lon: 80.2575, ward: 'Ward 173 (Zone 13 Adyar)', authority_key: 'chennai' },
  { name: 'T. Nagar (Ranganathan St & Pondy Bazaar)', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017', lat: 13.0418, lon: 80.2341, ward: 'Ward 136 (Zone 10 T. Nagar)', authority_key: 'chennai' },
  { name: 'Anna Nagar West (2nd Avenue)', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', lat: 13.0878, lon: 80.2075, ward: 'Ward 101 (Zone 8 Anna Nagar)', authority_key: 'chennai' },
  { name: 'Mylapore (Luz Corner & Kapaleeshwarar)', city: 'Chennai', state: 'Tamil Nadu', pincode: '600004', lat: 13.0339, lon: 80.2694, ward: 'Ward 124 (Zone 9 Mylapore)', authority_key: 'chennai' },
  { name: 'Velachery Bypass Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600042', lat: 12.9759, lon: 80.2212, ward: 'Ward 178 (Zone 13)', authority_key: 'chennai' },
  { name: 'Besant Nagar (Elliot Beach)', city: 'Chennai', state: 'Tamil Nadu', pincode: '600090', lat: 13.0001, lon: 80.2667, ward: 'Ward 175 (Zone 13)', authority_key: 'chennai' },

  // Hyderabad
  { name: 'Hitec City / Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081', lat: 17.4483, lon: 78.3915, ward: 'Ward 106 (Serilingampally Zone)', authority_key: 'hyderabad' },
  { name: 'Banjara Hills Road No 12', city: 'Hyderabad', state: 'Telangana', pincode: '500034', lat: 17.4156, lon: 78.4357, ward: 'Ward 93 (Khairatabad Zone)', authority_key: 'hyderabad' },
  { name: 'Jubilee Hills Check Post', city: 'Hyderabad', state: 'Telangana', pincode: '500033', lat: 17.4319, lon: 78.4073, ward: 'Ward 94 (Khairatabad Zone)', authority_key: 'hyderabad' },
  { name: 'Secunderabad (MG Road / Paradise)', city: 'Hyderabad', state: 'Telangana', pincode: '500003', lat: 17.4399, lon: 78.4983, ward: 'Ward 147 (Secunderabad Zone)', authority_key: 'hyderabad' },
  { name: 'Charminar / Laad Bazaar', city: 'Hyderabad', state: 'Telangana', pincode: '500002', lat: 17.3616, lon: 78.4747, ward: 'Ward 46 (Charminar Zone)', authority_key: 'hyderabad' },
  { name: 'Kukatpally Housing Board (KPHB)', city: 'Hyderabad', state: 'Telangana', pincode: '500072', lat: 17.4947, lon: 78.3996, ward: 'Ward 119 (Kukatpally Zone)', authority_key: 'hyderabad' },
  { name: 'Gachibowli DLF Cybercity', city: 'Hyderabad', state: 'Telangana', pincode: '500032', lat: 17.4401, lon: 78.3489, ward: 'Ward 105 (Serilingampally Zone)', authority_key: 'hyderabad' },

  // Pune
  { name: 'Kothrud (Paud Road / Vanaz)', city: 'Pune', state: 'Maharashtra', pincode: '411038', lat: 18.5074, lon: 73.8077, ward: 'Ward 31 (Kothrud-Bavdhan)', authority_key: 'pune' },
  { name: 'Viman Nagar (Datta Mandir Chowk)', city: 'Pune', state: 'Maharashtra', pincode: '411014', lat: 18.5679, lon: 73.9143, ward: 'Ward 4 (Nagar Road Ward)', authority_key: 'pune' },
  { name: 'Shivajinagar FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411005', lat: 18.5284, lon: 73.8419, ward: 'Ward 14 (Shivajinagar-Ghole Rd)', authority_key: 'pune' },
  { name: 'Baner Main Road', city: 'Pune', state: 'Maharashtra', pincode: '411045', lat: 18.5590, lon: 73.7868, ward: 'Ward 9 (Aundh-Baner)', authority_key: 'pune' },
  { name: 'Hadapsar (Magarpatta City)', city: 'Pune', state: 'Maharashtra', pincode: '411028', lat: 18.5133, lon: 73.9242, ward: 'Ward 21 (Hadapsar Ward)', authority_key: 'pune' },
  { name: 'Hinjewadi Phase 1 IT Park', city: 'Pune', state: 'Maharashtra', pincode: '411057', lat: 18.5913, lon: 73.7389, ward: 'PMRDA Hinjewadi Zone', authority_key: 'pune' },

  // Kolkata
  { name: 'Salt Lake Sector V (College More)', city: 'Kolkata', state: 'West Bengal', pincode: '700091', lat: 22.5726, lon: 88.4312, ward: 'Ward 128 (Bidhannagar)', authority_key: 'kolkata' },
  { name: 'Park Circus / 7 Point Crossing', city: 'Kolkata', state: 'West Bengal', pincode: '700017', lat: 22.5393, lon: 88.3662, ward: 'Ward 64 (Borough VII)', authority_key: 'kolkata' },
  { name: 'Gariahat Market Crossing', city: 'Kolkata', state: 'West Bengal', pincode: '700019', lat: 22.5195, lon: 88.3653, ward: 'Ward 85 (Borough VIII)', authority_key: 'kolkata' },
  { name: 'Howrah Railway Station Area', city: 'Kolkata', state: 'West Bengal', pincode: '711101', lat: 22.5850, lon: 88.3426, ward: 'Howrah Municipal Corp Ward 1', authority_key: 'kolkata' },
  { name: 'New Town Action Area 1', city: 'Kolkata', state: 'West Bengal', pincode: '700156', lat: 22.5867, lon: 88.4754, ward: 'NKDA New Town Area 1', authority_key: 'kolkata' },

  // Other Major Metros
  { name: 'Navrangpura, Ahmedabad', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009', lat: 23.0365, lon: 72.5611, ward: 'AMC West Zone', authority_key: 'national' },
  { name: 'Hazratganj, Lucknow', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', lat: 26.8500, lon: 80.9499, ward: 'LMC Zone 1', authority_key: 'national' },
  { name: 'MI Road, Jaipur', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', lat: 26.9196, lon: 75.8130, ward: 'JMC Heritage Zone', authority_key: 'national' },
  { name: 'Sector 17 Plaza, Chandigarh', city: 'Chandigarh', state: 'Chandigarh', pincode: '160017', lat: 30.7398, lon: 76.7827, ward: 'MCC Ward 2', authority_key: 'national' }
];

/**
 * GET /api/search-locations
 * Instantaneous fuzzy/keyword search for any area, ward, or city across India.
 * Blends high-speed pre-indexed localities with dynamic OpenStreetMap Nominatim queries.
 */
router.get('/search-locations', async (req, res) => {
  const query = (req.query.q || '').toString().trim().toLowerCase();

  if (!query || query.length < 2) {
    // Return curated representative areas across India
    return res.json({
      success: true,
      data: INDIAN_LOCALITIES_INDEX.slice(0, 10).map((loc, idx) => ({
        id: `loc-default-${idx}`,
        ...loc,
        display_name: `${loc.name}, ${loc.city}, ${loc.state} (${loc.pincode})`
      }))
    });
  }

  // 1. Filter local index with relevance scoring
  const localMatches = INDIAN_LOCALITIES_INDEX.filter((loc) => {
    return (
      loc.name.toLowerCase().includes(query) ||
      loc.city.toLowerCase().includes(query) ||
      loc.state.toLowerCase().includes(query) ||
      loc.pincode.includes(query) ||
      (loc.ward && loc.ward.toLowerCase().includes(query))
    );
  }).map((loc, idx) => ({
    id: `loc-idx-${idx}`,
    ...loc,
    display_name: `${loc.name}, ${loc.city}, ${loc.state} (${loc.pincode})`,
    source: 'local_index'
  }));

  // 2. If we have good local matches (>= 4), return immediately for zero-latency response
  if (localMatches.length >= 4) {
    return res.json({
      success: true,
      data: localMatches.slice(0, 12)
    });
  }

  // 3. Otherwise, augment with OpenStreetMap Nominatim for arbitrary Indian locations
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);

    const nominatimSearchUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=8&addressdetails=1&q=${encodeURIComponent(query)}`;
    const osmRes = await fetch(nominatimSearchUrl, {
      headers: { 'User-Agent': 'SahaayAI-Civic-App/1.0 (contact@sahaay.org)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (osmRes.ok) {
      const osmData = await osmRes.json();
      const osmMatches = osmData.map((item, idx) => {
        const addr = item.address || {};
        const city = addr.city || addr.town || addr.municipality || addr.state_district || 'India';
        const neighborhood = addr.suburb || addr.neighbourhood || addr.residential || item.name || '';
        return {
          id: `loc-osm-${idx}`,
          name: neighborhood || item.name,
          city,
          state: addr.state || '',
          pincode: addr.postcode || '',
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          ward: addr.suburb || neighborhood,
          display_name: item.display_name,
          source: 'nominatim_osm'
        };
      });

      // Combine local + OSM matches, avoiding exact duplicates
      const combined = [...localMatches];
      osmMatches.forEach((osm) => {
        const alreadyExists = combined.some(
          (c) => Math.abs(c.lat - osm.lat) < 0.01 && Math.abs(c.lon - osm.lon) < 0.01
        );
        if (!alreadyExists) {
          combined.push(osm);
        }
      });

      return res.json({
        success: true,
        data: combined.slice(0, 15)
      });
    }
  } catch (err) {
    // Network fallback: return local matches
  }

  return res.json({
    success: true,
    data: localMatches
  });
});

/**
 * POST /api/analyze
 * Multimodal analysis with Gemini (Supports Text, Photo, and Audio uploads)
 */
router.post('/analyze', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  try {
    let text = req.body.text || '';
    let location = {};
    let inputType = req.body.inputType || 'text';

    // Parse location
    if (typeof req.body.location === 'string') {
      try {
        location = JSON.parse(req.body.location);
      } catch {
        location = { address: req.body.location };
      }
    } else if (typeof req.body.location === 'object' && req.body.location !== null) {
      location = req.body.location;
    }

    // Process uploaded image if present
    let imageData = null;
    const files = req.files || {};
    if (files.image && files.image[0]) {
      const img = files.image[0];
      imageData = {
        data: img.buffer.toString('base64'),
        mimeType: img.mimetype,
        size: img.size
      };
    } else if (req.body.imageBase64) {
      imageData = {
        data: req.body.imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        mimeType: req.body.imageMimeType || 'image/jpeg'
      };
    }

    // Process uploaded audio if present
    let audioData = null;
    if (files.audio && files.audio[0]) {
      const aud = files.audio[0];
      audioData = {
        data: aud.buffer.toString('base64'),
        mimeType: aud.mimetype,
        size: aud.size
      };
      inputType = 'voice';
    } else if (req.body.audioBase64) {
      audioData = {
        data: req.body.audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, ''),
        mimeType: req.body.audioMimeType || 'audio/mp3'
      };
      inputType = 'voice';
    }

    // Validation: Require at least one form of input
    if (!text.trim() && !imageData && !audioData) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a text description, upload a photograph, or submit an audio note.'
      });
    }

    // 1. Run Gemini Analysis
    const analysis = await analyzeSanitationIssue({
      text: text.trim(),
      image: imageData,
      audio: audioData,
      location,
      inputType
    });

    // 2. Run Independent Verification Engine
    const verification = performVerification({
      report: analysis,
      location: analysis.location || location
    });

    analysis.verification = verification;

    // 3. Spatial Proximity Duplicate Check (< 75 meters)
    if (location.latitude && location.longitude) {
      const allReports = db.getAllReports();
      const currentLat = parseFloat(location.latitude);
      const currentLon = parseFloat(location.longitude);

      for (const rep of allReports) {
        if (rep.status !== 'resolved' && rep.location_json?.latitude && rep.location_json?.longitude) {
          const rLat = parseFloat(rep.location_json.latitude);
          const rLon = parseFloat(rep.location_json.longitude);
          
          // Haversine distance calculation in meters
          const R = 6371e3;
          const dLat = (rLat - currentLat) * Math.PI / 180;
          const dLon = (rLon - currentLon) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(currentLat * Math.PI / 180) * Math.cos(rLat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceMeters = Math.round(R * c);

          if (distanceMeters <= 75) {
            analysis.nearby_duplicate = {
              id: rep.id,
              issue_title: rep.issue_title,
              category: rep.category,
              distance_meters: distanceMeters,
              endorsements_count: rep.endorsements_count || 1,
              status: rep.status
            };
            break;
          }
        }
      }
    }

    return res.json({
      success: true,
      data: analysis
    });
  } catch (err) {
    console.error('API Error in /api/analyze:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while analyzing the sanitation issue. Please try again.'
    });
  }
});

/**
 * POST /api/verify
 */
router.post('/verify', (req, res) => {
  try {
    const { report, location, claims } = req.body;
    const verification = performVerification({
      report,
      location: location || report?.location,
      claims: claims || []
    });

    return res.json({
      success: true,
      data: verification
    });
  } catch (err) {
    console.error('API Error in /api/verify:', err);
    return res.status(500).json({
      success: false,
      error: 'Verification could not be processed.'
    });
  }
});

/**
 * GET /api/reports
 */
router.get('/reports', (req, res) => {
  try {
    const reports = db.getAllReports();
    return res.json({
      success: true,
      data: reports
    });
  } catch (err) {
    console.error('Error fetching reports:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve reports from persistence store.'
    });
  }
});

/**
 * GET /api/reports/:id
 */
router.get('/reports/:id', (req, res) => {
  try {
    const report = db.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: `Report ${req.params.id} was not found.`
      });
    }
    return res.json({
      success: true,
      data: report
    });
  } catch (err) {
    console.error('Error fetching report:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve report.'
    });
  }
});

/**
 * POST /api/reports
 */
router.post('/reports', (req, res) => {
  try {
    const reportData = req.body;
    if (!reportData || (!reportData.issue_title && !reportData.problem_summary)) {
      return res.status(400).json({
        success: false,
        error: 'Report must include an issue title or summary.'
      });
    }

    const created = db.createReport(reportData);
    return res.status(201).json({
      success: true,
      data: created
    });
  } catch (err) {
    console.error('Error saving report:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to save report.'
    });
  }
});

/**
 * PATCH /api/reports/:id
 * Supports updating status, resolution proof, and notes
 */
router.patch('/reports/:id', (req, res) => {
  try {
    const updated = db.updateReport(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Report ${req.params.id} was not found.`
      });
    }
    return res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    console.error('Error updating report:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update report.'
    });
  }
});

/**
 * POST /api/reports/:id/endorse
 * Citizen co-signature / upvote endorsement
 */
router.post('/reports/:id/endorse', (req, res) => {
  try {
    const updated = db.endorseReport(req.params.id);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Report ${req.params.id} was not found.`
      });
    }
    return res.json({
      success: true,
      data: updated
    });
  } catch (err) {
    console.error('Error endorsing report:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to record citizen endorsement.'
    });
  }
});

/**
 * DELETE /api/reports/:id
 */
router.delete('/reports/:id', (req, res) => {
  try {
    const ok = db.deleteReport(req.params.id);
    if (!ok) {
      return res.status(404).json({
        success: false,
        error: `Report ${req.params.id} was not found.`
      });
    }
    return res.json({
      success: true,
      message: 'Report deleted successfully.'
    });
  } catch (err) {
    console.error('Error deleting report:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete report.'
    });
  }
});

/**
 * POST /api/reports/:id/submit
 */
router.post('/reports/:id/submit', (req, res) => {
  try {
    const report = db.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: `Report ${req.params.id} not found.`
      });
    }

    const authority = identifyAuthority(report.location_json);

    return res.json({
      success: false,
      direct_api_submission_available: false,
      message: `Direct automated server-side filing is not supported without citizen phone/OTP authentication by ${authority.name}. Sahaay AI has prepared your verified complaint ready to paste directly into their official portal or mobile app.`,
      authority: {
        name: authority.name,
        portal_url: authority.portal_url,
        mobile_app: authority.mobile_app,
        helpline: authority.helpline
      },
      recommended_action: `Open the official ${authority.name} portal, sign in with your mobile number, and paste your prepared Sahaay AI complaint draft.`
    });
  } catch (err) {
    console.error('Error handling report submission:', err);
    return res.status(500).json({
      success: false,
      error: 'Submission routing failed.'
    });
  }
});
