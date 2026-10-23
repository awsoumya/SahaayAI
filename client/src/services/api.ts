import { BackendHealth, MunicipalAuthority, SanitationReport, VerificationData, LocationData } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function checkBackendHealth(): Promise<BackendHealth> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function getAuthorities(): Promise<MunicipalAuthority[]> {
  const res = await fetch(`${API_BASE}/api/authorities`);
  if (!res.ok) {
    throw new Error('Failed to retrieve municipal authorities');
  }
  const json = await res.json();
  return json.data;
}

export async function reverseGeocode(lat: number, lon: number): Promise<LocationData> {
  const res = await fetch(`${API_BASE}/api/reverse-geocode?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    throw new Error('Reverse geocoding failed');
  }
  const json = await res.json();
  return json.data;
}

export interface SearchedLocation {
  id: string;
  name: string;
  city: string;
  state?: string;
  pincode?: string;
  lat: number;
  lon: number;
  ward?: string;
  display_name: string;
  authority_key?: string;
  source?: string;
}

export async function searchLocations(query: string): Promise<SearchedLocation[]> {
  const res = await fetch(`${API_BASE}/api/search-locations?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  return json.data || [];
}

export interface AnalyzePayload {
  text?: string;
  imageFile?: File | null;
  audioFile?: File | null;
  imageBase64?: string | null;
  imageMimeType?: string;
  location?: Record<string, any>;
  inputType?: 'text' | 'voice' | 'image';
}

export async function analyzeSanitationIssue(payload: AnalyzePayload): Promise<SanitationReport> {
  let body: BodyInit;
  const headers: Record<string, string> = {};

  if (payload.imageFile || payload.audioFile) {
    const formData = new FormData();
    if (payload.text) formData.append('text', payload.text);
    if (payload.location) formData.append('location', JSON.stringify(payload.location));
    formData.append('inputType', payload.inputType || 'text');
    if (payload.imageFile) formData.append('image', payload.imageFile);
    if (payload.audioFile) formData.append('audio', payload.audioFile);
    body = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      text: payload.text || '',
      location: payload.location || {},
      inputType: payload.inputType || 'text',
      imageBase64: payload.imageBase64 || null,
      imageMimeType: payload.imageMimeType || 'image/jpeg',
    });
  }

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers,
    body,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to analyze sanitation issue');
  }

  return json.data;
}

export async function verifyClaims(
  report: SanitationReport,
  location?: Record<string, any>
): Promise<VerificationData> {
  const res = await fetch(`${API_BASE}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report,
      location: location || report.location,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Verification failed');
  }

  return json.data;
}

export async function saveReport(report: Partial<SanitationReport>): Promise<SanitationReport> {
  const res = await fetch(`${API_BASE}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to save report');
  }

  return json.data;
}

export async function fetchAllReports(): Promise<SanitationReport[]> {
  const res = await fetch(`${API_BASE}/api/reports`);
  if (!res.ok) {
    throw new Error('Failed to fetch reports');
  }
  const json = await res.json();
  return json.data || [];
}

export async function updateReport(
  id: string,
  updates: Record<string, any>
): Promise<SanitationReport> {
  const res = await fetch(`${API_BASE}/api/reports/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to update report');
  }

  return json.data;
}

export async function deleteReport(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/${id}`, {
    method: 'DELETE',
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to delete report');
  }
}

export async function endorseReport(id: string): Promise<SanitationReport> {
  const res = await fetch(`${API_BASE}/api/reports/${id}/endorse`, {
    method: 'POST',
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to endorse report');
  }

  return json.data;
}

export async function submitReportToOfficial(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/reports/${id}/submit`, {
    method: 'POST',
  });
  return res.json();
}
