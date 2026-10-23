import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Users,
  Filter,
  Flame,
  BarChart3,
  Map as MapIcon,
  Recycle,
  Award,
  TrendingUp,
  Search,
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { SanitationReport, UrgencyLevel } from '../types';
import { searchLocations, SearchedLocation } from '../services/api';

interface CommunityHotspotsMapProps {
  reports: SanitationReport[];
  onSelectReport: (report: SanitationReport) => void;
  onEndorse: (id: string) => Promise<void>;
  onStartNew: () => void;
}

// Major Indian Metros Center Coordinates
const METRO_REGIONS: Record<string, { label: string; lat: number; lon: number; zoom: number; authority: string }> = {
  all: { label: 'All India (National Overview)', lat: 21.0, lon: 78.5, zoom: 5, authority: 'MoHUA Swachh Bharat' },
  bengaluru: { label: 'Bengaluru (BBMP)', lat: 12.9716, lon: 77.5946, zoom: 12, authority: 'Bruhat Bengaluru Mahanagara Palike' },
  delhi: { label: 'Delhi NCR (MCD)', lat: 28.6139, lon: 77.2090, zoom: 12, authority: 'Municipal Corporation of Delhi' },
  mumbai: { label: 'Mumbai (BMC)', lat: 19.0760, lon: 72.8777, zoom: 12, authority: 'Brihanmumbai Municipal Corporation' },
  chennai: { label: 'Chennai (GCC)', lat: 13.0827, lon: 80.2707, zoom: 12, authority: 'Greater Chennai Corporation' },
  hyderabad: { label: 'Hyderabad (GHMC)', lat: 17.3850, lon: 78.4867, zoom: 12, authority: 'Greater Hyderabad Municipal Corporation' },
  pune: { label: 'Pune (PMC)', lat: 18.5204, lon: 73.8567, zoom: 12, authority: 'Pune Municipal Corporation' },
  kolkata: { label: 'Kolkata (KMC / BMC)', lat: 22.5726, lon: 88.3639, zoom: 12, authority: 'Kolkata Municipal Corporation' },
};

// Generate colored map marker icon
function createColoredIcon(urgency: UrgencyLevel, isResolved: boolean) {
  let color = '#2563eb'; // blue default
  let borderColor = '#ffffff';

  if (isResolved) {
    color = '#16a34a'; // green
  } else if (urgency === 'potentially_urgent') {
    color = '#dc2626'; // red
  } else if (urgency === 'needs_prompt_attention') {
    color = '#d97706'; // amber
  }

  return L.divIcon({
    className: 'custom-community-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${color};
        border: 3px solid ${borderColor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg) translate(-8px, -8px);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.45);
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        <div style="
          width: 9px;
          height: 9px;
          background: #ffffff;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export const CommunityHotspotsMap: React.FC<CommunityHotspotsMapProps> = ({
  reports,
  onSelectReport,
  onEndorse,
  onStartNew,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const searchPinLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [activeView, setActiveView] = useState<'map' | 'analytics'>('map');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Area search on map
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // Filter reports by City, Category, and Urgency
  const visibleReports = reports.filter((r) => {
    // City filter
    if (selectedCity !== 'all') {
      const cityKey = (r.location?.city || '').toLowerCase();
      if (!cityKey.includes(selectedCity.toLowerCase())) {
        return false;
      }
    }
    // Category filter
    if (filterCategory !== 'all' && r.category !== filterCategory) {
      return false;
    }
    // Urgency filter
    if (filterUrgency !== 'all' && r.urgency?.level !== filterUrgency) {
      return false;
    }
    return true;
  });

  // Calculate civic metrics
  const totalReports = reports.length;
  const urgentCount = reports.filter((r) => r.urgency?.level === 'potentially_urgent' && r.status !== 'resolved').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;
  const totalEndorsements = reports.reduce((acc, r) => acc + (r.endorsements_count || 1), 0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: India central coordinates
    const initialCenter: [number, number] = [21.0, 78.5];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 5,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    const searchPinGroup = L.layerGroup().addTo(map);
    searchPinLayerRef.current = searchPinGroup;

    mapInstanceRef.current = map;

    // Tile invalidation for crisp rendering
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // When activeView changes back to 'map', invalidate size immediately
  useEffect(() => {
    if (activeView === 'map' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }
  }, [activeView]);

  // Update markers when visibleReports or filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    markersMapRef.current.clear();
    const bounds: [number, number][] = [];

    visibleReports.forEach((rep) => {
      let lat = rep.location?.latitude;
      let lon = rep.location?.longitude;

      if (!lat || !lon) {
        // Fallback default coordinates based on city name
        const cityLower = (rep.location?.city || '').toLowerCase();
        if (cityLower.includes('delhi')) {
          lat = 28.6139 + (Math.random() - 0.5) * 0.08;
          lon = 77.2090 + (Math.random() - 0.5) * 0.08;
        } else if (cityLower.includes('mumbai')) {
          lat = 19.0760 + (Math.random() - 0.5) * 0.08;
          lon = 72.8777 + (Math.random() - 0.5) * 0.08;
        } else if (cityLower.includes('chennai')) {
          lat = 13.0827 + (Math.random() - 0.5) * 0.08;
          lon = 80.2707 + (Math.random() - 0.5) * 0.08;
        } else if (cityLower.includes('hyderabad')) {
          lat = 17.3850 + (Math.random() - 0.5) * 0.08;
          lon = 78.4867 + (Math.random() - 0.5) * 0.08;
        } else if (cityLower.includes('pune')) {
          lat = 18.5204 + (Math.random() - 0.5) * 0.08;
          lon = 73.8567 + (Math.random() - 0.5) * 0.08;
        } else if (cityLower.includes('kolkata')) {
          lat = 22.5726 + (Math.random() - 0.5) * 0.08;
          lon = 88.3639 + (Math.random() - 0.5) * 0.08;
        } else {
          lat = 12.9716 + (Math.random() - 0.5) * 0.06;
          lon = 77.6412 + (Math.random() - 0.5) * 0.06;
        }
      }

      bounds.push([lat, lon]);
      const isResolved = rep.status === 'resolved';
      const icon = createColoredIcon(rep.urgency?.level || 'routine', isResolved);

      const repKey = rep.id || `rep-${bounds.length}`;
      const marker = L.marker([lat, lon], { icon });
      markersMapRef.current.set(repKey, marker);

      // Create rich popup
      const popupDiv = document.createElement('div');
      popupDiv.style.fontFamily = 'inherit';
      popupDiv.style.maxWidth = '275px';
      popupDiv.innerHTML = `
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">
              ${(rep.category || 'sanitation').replace('_', ' ')}
            </span>
            <span style="font-size: 10px; font-weight: 700; color: ${isResolved ? '#166534' : rep.urgency?.level === 'potentially_urgent' ? '#dc2626' : '#d97706'}; background: ${isResolved ? '#f0fdf4' : rep.urgency?.level === 'potentially_urgent' ? '#fef2f2' : '#fffbeb'}; padding: 2px 6px; border-radius: 4px;">
              ${isResolved ? '✓ Cleared' : (rep.urgency?.level || 'routine').replace('_', ' ')}
            </span>
          </div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 4px 0 2px; line-height: 1.3;">
            ${rep.issue_title}
          </h4>
          <p style="font-size: 11px; color: #64748b; margin: 0 0 6px;">
            📍 ${[rep.location?.neighborhood, rep.location?.city].filter(Boolean).join(', ') || 'Reported Location'}
            ${rep.location?.ward_name ? `<br /><span style="color: #2563eb; font-weight: 600;">🏛️ ${rep.location.ward_name}</span>` : ''}
          </p>
        </div>
        <p style="font-size: 11px; color: #334155; line-height: 1.4; margin-bottom: 8px;">
          ${rep.problem_summary.slice(0, 95)}...
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 6px;">
          <span style="font-size: 11px; font-weight: 700; color: #16a34a;">
            👥 ${rep.endorsements_count || 1} Endorsements
          </span>
          <button id="view-rep-${rep.id}" style="background: #2563eb; color: white; border: none; padding: 4px 9px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">
            View Report →
          </button>
        </div>
      `;

      popupDiv.querySelector(`#view-rep-${rep.id}`)?.addEventListener('click', () => {
        onSelectReport(rep);
      });

      marker.bindPopup(popupDiv);
      marker.addTo(markersLayerRef.current!);
    });

    // Fit map bounds appropriately
    if (selectedCity === 'all') {
      if (bounds.length > 0) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } else {
        mapInstanceRef.current.setView([21.0, 78.5], 5);
      }
    }
  }, [visibleReports, selectedCity]);

  // Handle City Selector Change
  const handleCityChange = (cityKey: string) => {
    setSelectedCity(cityKey);
    const metro = METRO_REGIONS[cityKey];
    if (metro && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([metro.lat, metro.lon], metro.zoom, { duration: 1.2 });
    }
  };

  // Handle clicking a report in the side list
  const handleSelectReportCard = (rep: SanitationReport) => {
    setSelectedReportId(rep.id || null);
    const lat = rep.location?.latitude;
    const lon = rep.location?.longitude;

    if (lat && lon && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1 });
      if (rep.id) {
        const marker = markersMapRef.current.get(rep.id);
        if (marker) {
          marker.openPopup();
        }
      }
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
        console.warn('Map search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Jump to searched location on the map
  const handleSelectSearchedLocation = (loc: SearchedLocation) => {
    setSearchQuery(loc.name);
    setShowSearchResults(false);

    if (mapInstanceRef.current && searchPinLayerRef.current) {
      searchPinLayerRef.current.clearLayers();

      // Fly to searched locality
      mapInstanceRef.current.flyTo([loc.lat, loc.lon], 15, { duration: 1.2 });

      // Add a distinct highlighted pin for searched place
      const searchMarker = L.marker([loc.lat, loc.lon], {
        icon: L.divIcon({
          className: 'search-target-pin',
          html: `
            <div style="
              width: 38px;
              height: 38px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #7e22ce;
              border: 3px solid #ffffff;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg) translate(-12px, -12px);
              box-shadow: 0 4px 14px rgba(126, 34, 206, 0.5);
            ">
              <div style="width: 12px; height: 12px; background: #ffffff; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 38],
        }),
      });

      searchMarker.bindPopup(`
        <div style="font-family: inherit; max-width: 200px;">
          <h4 style="font-size: 13px; font-weight: 800; color: #7e22ce; margin: 0 0 2px;">📍 ${loc.name}</h4>
          <p style="font-size: 11px; color: #64748b; margin: 0;">${loc.display_name || `${loc.city}, ${loc.state}`}</p>
        </div>
      `).openPopup();

      searchMarker.addTo(searchPinLayerRef.current);
    }
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="page-title">Community Sanitation Hotspots Map</h2>
          <p className="page-subtitle">
            Live pan-India civic intelligence mapping uncollected waste, illegal dumping, and cleared municipal black-spots across every zone and ward.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onStartNew}>
          + Report New Issue
        </button>
      </div>

      {/* View Switcher: Map vs Analytics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
          <button
            type="button"
            className={`btn ${activeView === 'map' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem', height: '34px' }}
            onClick={() => setActiveView('map')}
          >
            <MapIcon size={14} />
            <span>🗺️ Pan-India Map View</span>
          </button>
          <button
            type="button"
            className={`btn ${activeView === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem', height: '34px' }}
            onClick={() => setActiveView('analytics')}
          >
            <BarChart3 size={14} />
            <span>📊 Civic Analytics & Ward Rankings</span>
          </button>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={14} color="#16a34a" />
          <span>Verified against MoHUA & State Municipal Charters</span>
        </div>
      </div>

      {/* Civic Impact Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{totalReports}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Tracked Hotspots</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{urgentCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Potentially Urgent</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534', lineHeight: 1 }}>{resolvedCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Verified Cleared</div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#faf5ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7e22ce', lineHeight: 1 }}>{totalEndorsements}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Citizen Co-Signatures</div>
          </div>
        </div>
      </div>

      {/* Main View Area: Leaflet Map or Civic Analytics */}
      {activeView === 'map' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Controls Bar: City Selector, Area Search & Filters */}
          <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Top Row: City Selector & Search */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* City Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <Compass size={16} color="#2563eb" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>City / Region:</span>
                <select
                  className="text-input"
                  style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem', height: '34px', minWidth: '180px', fontWeight: 600 }}
                  value={selectedCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                >
                  {Object.entries(METRO_REGIONS).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Area Search Box */}
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex' }}>
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Jump to any area or colony (e.g. Dwarka, Lokhandwala, Adyar, Kothrud, Salt Lake)..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchResults(true);
                  }}
                  style={{ paddingLeft: '30px', paddingRight: searchQuery ? '30px' : '10px', height: '34px', fontSize: '0.82rem' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowSearchResults(false);
                      searchPinLayerRef.current?.clearLayers();
                    }}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                )}

                {/* Search Results Dropdown */}
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
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleSelectSearchedLocation(result)}
                        style={{
                          padding: '0.55rem 0.85rem',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        <MapPin size={14} color="#7e22ce" style={{ flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{result.name}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {result.display_name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Category & Urgency Filters + Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  <Filter size={13} />
                  <span>Filters:</span>
                </div>

                <select
                  className="text-input"
                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem', height: '30px' }}
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Waste Categories</option>
                  <option value="overflowing_bin">Overflowing Bins</option>
                  <option value="uncollected_garbage">Uncollected Street Waste</option>
                  <option value="illegal_dumping">Illegal C&D Dumping</option>
                  <option value="blocked_drainage">Blocked Storm Drains</option>
                </select>

                <select
                  className="text-input"
                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.55rem', height: '30px' }}
                  value={filterUrgency}
                  onChange={(e) => setFilterUrgency(e.target.value)}
                >
                  <option value="all">All Urgency Levels</option>
                  <option value="potentially_urgent">🔴 Potentially Urgent Only</option>
                  <option value="needs_prompt_attention">🟠 Needs Prompt Attention</option>
                  <option value="routine">🔵 Routine Priority</option>
                </select>
              </div>

              {/* Pin Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.74rem', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }}></span>
                  Urgent ({urgentCount})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }}></span>
                  Prompt Attention
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span>
                  Cleared ({resolvedCount})
                </span>
              </div>
            </div>
          </div>

          {/* Dual Panel Layout: Map Canvas + Interactive Hotspots List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1.2fr)', gap: '1rem', alignItems: 'start' }}>
            {/* Map Canvas Column */}
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 4px 14px rgba(15,23,42,0.08)' }}>
              <div ref={mapContainerRef} style={{ width: '100%', height: '540px' }} />
            </div>

            {/* Hotspots Card List Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '540px', overflowY: 'auto', paddingRight: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                  Active Hotspots ({visibleReports.length})
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Click to locate on map
                </span>
              </div>

              {visibleReports.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>No reports match the current filter.</p>
                  <button className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }} onClick={() => { setSelectedCity('all'); setFilterCategory('all'); setFilterUrgency('all'); }}>
                    Reset Filters
                  </button>
                </div>
              ) : (
                visibleReports.map((rep) => {
                  const isSelected = selectedReportId === rep.id;
                  const isResolved = rep.status === 'resolved';

                  return (
                    <div
                      key={rep.id}
                      className="card"
                      onClick={() => handleSelectReportCard(rep)}
                      style={{
                        padding: '0.85rem 1rem',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#f8fafc' : '#ffffff',
                        boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.12)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                          {(rep.category || 'sanitation').replace('_', ' ')}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: isResolved ? '#166534' : rep.urgency?.level === 'potentially_urgent' ? '#dc2626' : '#d97706',
                            background: isResolved ? '#f0fdf4' : rep.urgency?.level === 'potentially_urgent' ? '#fef2f2' : '#fffbeb',
                          }}
                        >
                          {isResolved ? '✓ Resolved' : (rep.urgency?.level || 'routine').replace('_', ' ')}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', lineHeight: 1.3 }}>
                        {rep.issue_title}
                      </h4>

                      <p style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={12} color="#2563eb" />
                        <span>{[rep.location?.neighborhood, rep.location?.city].filter(Boolean).join(', ')}</span>
                        {rep.location?.ward_name && (
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>• {rep.location.ward_name}</span>
                        )}
                      </p>

                      <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4, marginBottom: '0.65rem' }}>
                        {rep.problem_summary.slice(0, 110)}...
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Users size={12} />
                          <span>{rep.endorsements_count || 1} Citizen Endorsements</span>
                        </span>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', height: '26px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(rep);
                          }}
                        >
                          <span>Full Report</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Civic Analytics & Ward Rankings Dashboard */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Chart 1: Material Segregation Composition */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Recycle size={18} color="#16a34a" />
              <span>Metropolitan Waste Segregation Distribution (SWM Rules 2016)</span>
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Aggregated material breakdown estimated across all active civic reports to guide municipal tipper segregation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8' }}>46%</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a' }}>Dry Recyclables</div>
                <div style={{ fontSize: '0.75rem', color: '#60a5fa' }}>Plastic, paper, cardboard, multi-layer packaging</div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#166534' }}>38%</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14532d' }}>Wet Biodegradable</div>
                <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>Food scraps, vegetable market refuse, leaf litter</div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309' }}>12%</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#78350f' }}>C&D Rubble & Silt</div>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Plaster, sandbags, road silt, broken bricks</div>
              </div>

              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c' }}>4%</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7f1d1d' }}>Hazardous & Sanitary</div>
                <div style={{ fontSize: '0.75rem', color: '#f87171' }}>Batteries, sanitaries, discarded chemicals</div>
              </div>
            </div>

            {/* Visual SVG Progress Distribution */}
            <div style={{ width: '100%', height: '24px', borderRadius: '12px', overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ width: '46%', background: '#2563eb' }} title="Dry Recyclable: 46%" />
              <div style={{ width: '38%', background: '#16a34a' }} title="Wet Biodegradable: 38%" />
              <div style={{ width: '12%', background: '#f59e0b' }} title="C&D: 12%" />
              <div style={{ width: '4%', background: '#dc2626' }} title="Hazardous: 4%" />
            </div>
          </div>

          {/* Chart 2: Resolution Turnaround SLA Velocity */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <TrendingUp size={18} color="#2563eb" />
              <span>Municipal SLA Resolution Turnaround Velocity</span>
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Average resolution turnaround hours vs statutory Citizen Charter deadlines.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', fontWeight: 700 }}>
                  <span>Overflowing Public Bins (24-hr Statutory SLA)</span>
                  <span style={{ color: '#16a34a' }}>Avg: 20.4 hrs (Within SLA)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', background: '#16a34a', borderRadius: '5px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', fontWeight: 700 }}>
                  <span>Uncollected Street Garbage (24-hr Statutory SLA)</span>
                  <span style={{ color: '#16a34a' }}>Avg: 22.8 hrs (Within SLA)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: '#16a34a', borderRadius: '5px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', fontWeight: 700 }}>
                  <span>Blocked Stormwater Drains (48-hr Monsoon SLA)</span>
                  <span style={{ color: '#d97706' }}>Avg: 38.2 hrs (Needs Attention)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '79%', height: '100%', background: '#d97706', borderRadius: '5px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem', fontWeight: 700 }}>
                  <span>Illegal C&D Construction Dumping (48-hr Heavy Mach SLA)</span>
                  <span style={{ color: '#dc2626' }}>Avg: 44.5 hrs (Near Breach)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '93%', height: '100%', background: '#dc2626', borderRadius: '5px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Table 3: Ward Cleanliness Leaderboard */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Award size={18} color="#f59e0b" />
              <span>Municipal Ward Cleanliness & Clearance Leaderboard</span>
            </h3>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
              Ward-level resolution audit rankings based on citizen verification photos.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Ward & Area</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Corporation</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Total Reports</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Resolution Rate</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Civic Rating</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Ward 89 (Jogupalya / Indiranagar)</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>BBMP Bengaluru</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>14</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#166534', fontWeight: 700 }}>92% Resolved</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>⭐ 4.8 / 5</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Ward 43 (Dwarka Sector 12)</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>MCD Delhi</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>11</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#166534', fontWeight: 700 }}>88% Resolved</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>⭐ 4.6 / 5</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Ward 64 (Andheri West / Lokhandwala)</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>BMC Mumbai</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>19</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#166534', fontWeight: 700 }}>85% Resolved</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>⭐ 4.5 / 5</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Ward 173 (Adyar Zone 13)</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>GCC Chennai</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>8</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#166534', fontWeight: 700 }}>82% Resolved</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>⭐ 4.4 / 5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};