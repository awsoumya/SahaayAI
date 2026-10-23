import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Loader2, Search, X, Compass, Check } from 'lucide-react';
import { reverseGeocode, searchLocations, SearchedLocation } from '../services/api';
import { LocationData } from '../types';

interface MapPickerProps {
  initialLat?: number | null;
  initialLon?: number | null;
  onLocationSelect: (location: LocationData) => void;
}

// Custom SVG Pin Icon to eliminate bundler PNG asset resolution issues
const customPinIcon = L.divIcon({
  className: 'custom-leaflet-pin',
  html: `
    <div style="
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #2563eb;
      border: 3px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg) translate(-10px, -10px);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4);
      cursor: grab;
    ">
      <div style="
        width: 10px;
        height: 10px;
        background: #ffffff;
        border-radius: 50%;
      "></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

// Quick City Metros Preset
const QUICK_METROS = [
  { label: 'Bengaluru', lat: 12.9716, lon: 77.5946, city: 'Bengaluru' },
  { label: 'Delhi NCR', lat: 28.6139, lon: 77.2090, city: 'New Delhi' },
  { label: 'Mumbai', lat: 19.0760, lon: 72.8777, city: 'Mumbai' },
  { label: 'Chennai', lat: 13.0827, lon: 80.2707, city: 'Chennai' },
  { label: 'Hyderabad', lat: 17.3850, lon: 78.4867, city: 'Hyderabad' },
  { label: 'Pune', lat: 18.5204, lon: 73.8567, city: 'Pune' },
  { label: 'Kolkata', lat: 22.5726, lon: 88.3639, city: 'Kolkata' },
];

export const MapPicker: React.FC<MapPickerProps> = ({
  initialLat,
  initialLon,
  onLocationSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number }>({
    lat: initialLat || 12.9716, // Default: Bengaluru
    lon: initialLon || 77.5946,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentCoords.lat, currentCoords.lon],
      zoom: initialLat && initialLon ? 15 : 13,
      scrollWheelZoom: true,
    });

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Initial marker
    const marker = L.marker([currentCoords.lat, currentCoords.lon], {
      icon: customPinIcon,
      draggable: true,
    }).addTo(map);

    // Click handler to move marker
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCurrentCoords({ lat, lon: lng });
      setShowSearchResults(false);
      await triggerReverseGeocode(lat, lng);
    });

    // Drag end handler
    marker.on('dragend', async () => {
      const position = marker.getLatLng();
      setCurrentCoords({ lat: position.lat, lon: position.lng });
      await triggerReverseGeocode(position.lat, position.lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Fix grey tiles: force recalculation of container dimensions
    const resizeTimer1 = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    const resizeTimer2 = setTimeout(() => {
      map.invalidateSize();
    }, 450);

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(resizeTimer1);
      clearTimeout(resizeTimer2);
      window.removeEventListener('resize', handleWindowResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map center when props change externally
  useEffect(() => {
    if (initialLat && initialLon && mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([initialLat, initialLon], 15);
      markerRef.current.setLatLng([initialLat, initialLon]);
      setCurrentCoords({ lat: initialLat, lon: initialLon });
      mapInstanceRef.current.invalidateSize();
    }
  }, [initialLat, initialLon]);

  const triggerReverseGeocode = async (lat: number, lon: number) => {
    setIsGeocoding(true);
    try {
      const geo = await reverseGeocode(lat, lon);
      setResolvedAddress(geo.address || `${geo.neighborhood || ''}, ${geo.city || ''}`);
      onLocationSelect({
        ...geo,
        latitude: lat,
        longitude: lon,
        source: 'interactive_map',
        user_confirmation_required: false,
      });
    } catch (err) {
      console.warn('Reverse geocode error:', err);
      onLocationSelect({
        latitude: lat,
        longitude: lon,
        source: 'interactive_map',
        user_confirmation_required: true,
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  // Search input handler with debounce
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(val.trim());
        setSearchResults(results);
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Select location from search dropdown
  const handleSelectSearchedLocation = async (loc: SearchedLocation) => {
    setSearchQuery(loc.name);
    setShowSearchResults(false);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lon], 16, { duration: 1.2 });
      markerRef.current.setLatLng([loc.lat, loc.lon]);
    }
    setCurrentCoords({ lat: loc.lat, lon: loc.lon });
    setResolvedAddress(loc.display_name || `${loc.name}, ${loc.city}`);

    // Update parent immediately with high-accuracy search info
    onLocationSelect({
      city: loc.city,
      neighborhood: loc.name,
      address: loc.display_name,
      postcode: loc.pincode,
      latitude: loc.lat,
      longitude: loc.lon,
      source: 'search_autocomplete',
      user_confirmation_required: false,
    });
  };

  // Quick Metro Jump Chip click handler
  const handleFlyToMetro = async (metro: (typeof QUICK_METROS)[0]) => {
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([metro.lat, metro.lon], 14, { duration: 1 });
      markerRef.current.setLatLng([metro.lat, metro.lon]);
    }
    setCurrentCoords({ lat: metro.lat, lon: metro.lon });
    await triggerReverseGeocode(metro.lat, metro.lon);
  };

  const handleRecenter = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 1 });
          markerRef.current.setLatLng([latitude, longitude]);
        }
        setCurrentCoords({ lat: latitude, lon: longitude });
        await triggerReverseGeocode(latitude, longitude);
      },
      (err) => console.warn('Geolocation error:', err.message)
    );
  };

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 4px 14px rgba(15,23,42,0.08)' }}>
      {/* Top Search & Navigation Overlay */}
      <div style={{ padding: '0.75rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Search Input Row */}
        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              {isSearching ? <Loader2 size={15} className="spinner spinner-primary" /> : <Search size={15} />}
            </div>
            <input
              type="text"
              className="text-input"
              placeholder="Search any area, ward, or street in India (e.g. Dwarka, Lokhandwala, Adyar, Kothrud)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              style={{ paddingLeft: '32px', paddingRight: searchQuery ? '32px' : '10px', height: '36px', fontSize: '0.85rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}

            {/* Auto-complete Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 2000,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                  marginTop: '4px',
                  maxHeight: '230px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => handleSelectSearchedLocation(result)}
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <MapPin size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{result.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {result.display_name || `${result.city}, ${result.state || ''}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRecenter}
            className="btn btn-secondary"
            style={{ height: '36px', fontSize: '0.8rem', padding: '0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="Locate my GPS position"
          >
            <Navigation size={14} color="#2563eb" />
            <span>My GPS</span>
          </button>
        </div>

        {/* Quick City Jumps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
            <Compass size={12} color="#64748b" /> Quick Metro:
          </span>
          {QUICK_METROS.map((metro) => (
            <button
              key={metro.label}
              type="button"
              onClick={() => handleFlyToMetro(metro)}
              style={{
                fontSize: '0.73rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                background: currentCoords.lat.toFixed(1) === metro.lat.toFixed(1) ? '#eff6ff' : '#f8fafc',
                color: currentCoords.lat.toFixed(1) === metro.lat.toFixed(1) ? '#1d4ed8' : '#334155',
                fontWeight: currentCoords.lat.toFixed(1) === metro.lat.toFixed(1) ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              {currentCoords.lat.toFixed(1) === metro.lat.toFixed(1) && <Check size={11} />}
              {metro.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '280px', position: 'relative' }} />

      {/* Address Resolution Banner */}
      <div style={{ background: '#f8fafc', padding: '0.65rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
          {isGeocoding ? (
            <Loader2 size={14} className="spinner spinner-primary" />
          ) : (
            <MapPin size={14} color="#16a34a" />
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155', fontWeight: 600 }}>
            {isGeocoding
              ? 'Resolving street, ward & authority from coordinates...'
              : resolvedAddress || `Pin: ${currentCoords.lat.toFixed(4)}, ${currentCoords.lon.toFixed(4)}`}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0, marginLeft: '0.5rem' }}>
          Lat: {currentCoords.lat.toFixed(3)}, Lon: {currentCoords.lon.toFixed(3)}
        </span>
      </div>
    </div>
  );
};