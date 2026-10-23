export type SanitationCategory =
  | 'overflowing_bin'
  | 'uncollected_garbage'
  | 'illegal_dumping'
  | 'blocked_drainage'
  | 'waste_near_sensitive_zone'
  | 'littering_public_space'
  | 'general_sanitation';

export type UrgencyLevel = 'routine' | 'needs_prompt_attention' | 'potentially_urgent';

export type ReportStatus =
  | 'draft'
  | 'needs_more_info'
  | 'verification_pending'
  | 'ready_to_submit'
  | 'submitted'
  | 'resolved';

export interface LocationData {
  city?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  landmark?: string | null;
  source?: string;
  user_confirmation_required?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  postcode?: string | null;
  ward_number?: number | null;
  ward_name?: string | null;
  depot?: string | null;
}

export interface ObservationData {
  user_reported_facts: string[];
  visible_image_observations: string[];
  ai_inferences: string[];
  uncertainties: string[];
}

export interface BoundingBox {
  box_2d: number[]; // [ymin, xmin, ymax, xmax] 0 to 1000
  label: string;
  confidence: number;
  category?: string;
}

export interface WasteSegregationBreakdown {
  dry_recyclable_pct: number;
  wet_biodegradable_pct: number;
  construction_demolition_pct: number;
  hazardous_sanitary_pct: number;
  segregation_recommendations: string[];
}

export interface UrgencyData {
  level: UrgencyLevel;
  reasons: string[];
  limitations: string[];
}

export interface RecommendedAction {
  step: number;
  action: string;
  purpose: string;
}

export interface AuthoritativeSource {
  source_organization: string;
  source_title: string;
  official_url: string;
  helpline?: string;
  twitter_handle?: string;
  retrieved_at: string;
  confirms: string;
  is_authoritative?: boolean;
  is_current?: boolean;
}

export interface VerifiedClaim {
  claim: string;
  status: 'verified' | 'supported_by_media';
  basis: string;
}

export interface UnverifiedClaim {
  claim: string;
  status: 'unverified' | 'pending_municipal_inspection';
  basis: string;
  action_required?: string;
}

export interface ResolvedWard {
  city: string;
  zone: string;
  ward_number: number;
  ward_name: string;
  depot: string;
}

export interface MunicipalAuthority {
  key: string;
  name: string;
  jurisdiction: string;
  portal_url: string;
  mobile_app: string;
  helpline: string;
  whatsapp_helpline?: string;
  twitter_handle?: string;
  established_sla: string;
  official_policy?: string;
  verified: boolean;
  matched_pincode?: string;
  resolved_ward?: ResolvedWard;
}

export interface VerificationData {
  verification_status: 'verified' | 'verification_pending' | 'unverified';
  authority_identified: MunicipalAuthority;
  resolved_ward?: ResolvedWard | null;
  is_city_matched: boolean;
  verified_claims: VerifiedClaim[];
  unverified_claims: UnverifiedClaim[];
  authoritative_sources: AuthoritativeSource[];
  disclaimer: string;
  verified_at: string;
}

export interface ComplaintLangDraft {
  subject: string;
  body: string;
}

export interface ComplaintDrafts {
  en?: ComplaintLangDraft;
  hi?: ComplaintLangDraft;
  kn?: ComplaintLangDraft;
  ta?: ComplaintLangDraft;
  te?: ComplaintLangDraft;
  mr?: ComplaintLangDraft;
}

export interface ComplaintDraft {
  subject: string;
  body: string;
  subject_hindi?: string;
  body_hindi?: string;
}

export interface NearbyDuplicate {
  id: string;
  issue_title: string;
  category: string;
  distance_meters: number;
  endorsements_count: number;
  status: string;
}

export interface SanitationReport {
  id?: string;
  issue_title: string;
  category: SanitationCategory;
  problem_summary: string;
  input_types: string[];
  location: LocationData;
  observation: ObservationData;
  bounding_boxes?: BoundingBox[];
  waste_segregation_breakdown?: WasteSegregationBreakdown;
  urgency: UrgencyData;
  missing_information: string[];
  recommended_actions: RecommendedAction[];
  verification_requirements: string[];
  complaint_drafts?: ComplaintDrafts;
  complaint_draft: ComplaintDraft;
  verification?: VerificationData;
  status?: ReportStatus;
  sla_deadline?: string;
  sla_hours?: number;
  endorsements_count?: number;
  resolution_photo?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  nearby_duplicate?: NearbyDuplicate | null;
  created_at?: string;
  updated_at?: string;
  _meta?: {
    is_live_gemini?: boolean;
    is_demo_mode?: boolean;
    model?: string;
    demo_notice?: string;
    analyzed_at?: string;
  };
}

export interface BackendHealth {
  status: string;
  app: string;
  gemini: {
    configured: boolean;
    model: string;
    mode: 'live_api' | 'demonstration_fallback';
  };
  features?: {
    bilingual_complaints: boolean;
    reverse_geocoding: boolean;
    audio_upload: boolean;
    resolution_verification: boolean;
  };
  timestamp: string;
}
