import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'reports.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure database file exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
}

function readAll() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading reports database:', err);
    return [];
  }
}

function writeAll(reports) {
  const tmpFile = `${DB_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(reports, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export const db = {
  getAllReports() {
    return readAll().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getReportById(id) {
    const reports = readAll();
    return reports.find(r => r.id === id) || null;
  },

  createReport(data) {
    const reports = readAll();
    const id = `REP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    const slaHours = data.sla_hours || 24;
    const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

    const newReport = {
      id,
      issue_title: data.issue_title || 'Untitled Sanitation Report',
      category: data.category || 'general_sanitation',
      problem_summary: data.problem_summary || '',
      input_types: Array.isArray(data.input_types) ? data.input_types : ['text'],
      location_json: data.location || {
        city: null,
        neighborhood: null,
        address: null,
        landmark: null,
        latitude: null,
        longitude: null,
        source: 'not_provided',
        user_confirmation_required: true,
      },
      evidence_json: data.observation || {
        user_reported_facts: [],
        visible_image_observations: [],
        ai_inferences: [],
        uncertainties: [],
      },
      waste_segregation_breakdown: data.waste_segregation_breakdown || {
        dry_recyclable_pct: 45,
        wet_biodegradable_pct: 40,
        construction_demolition_pct: 10,
        hazardous_sanitary_pct: 5,
        segregation_recommendations: []
      },
      urgency_level: data.urgency?.level || 'needs_assessment',
      urgency_details: data.urgency || {
        level: 'needs_assessment',
        reasons: [],
        limitations: [],
      },
      recommended_actions_json: data.recommended_actions || [],
      missing_information: data.missing_information || [],
      verification_json: data.verification || {
        status: 'unverified',
        verified_claims: [],
        unverified_claims: [],
        authorities: [],
        disclaimer: 'Verification pending — we could not confirm this information from an available authoritative source.',
      },
      complaint_drafts: data.complaint_drafts || null,
      complaint_subject: data.complaint_draft?.subject || 'Civic Sanitation Issue Report',
      complaint_body: data.complaint_draft?.body || '',
      complaint_subject_hindi: data.complaint_draft?.subject_hindi || 'स्वच्छता समस्या निवारण पत्र',
      complaint_body_hindi: data.complaint_draft?.body_hindi || '',
      status: data.status || 'draft',
      sla_deadline: data.sla_deadline || slaDeadline,
      sla_hours: slaHours,
      endorsements_count: data.endorsements_count || 1,
      resolution_photo: data.resolution_photo || null,
      resolution_notes: data.resolution_notes || null,
      resolved_at: data.resolved_at || null,
      submission_details: data.submission_details || null,
      created_at: now,
      updated_at: now,
    };

    reports.push(newReport);
    writeAll(reports);
    return newReport;
  },

  endorseReport(id) {
    const reports = readAll();
    const index = reports.findIndex(r => r.id === id);
    if (index === -1) return null;

    reports[index].endorsements_count = (reports[index].endorsements_count || 1) + 1;
    reports[index].updated_at = new Date().toISOString();
    writeAll(reports);
    return reports[index];
  },

  updateReport(id, updates) {
    const reports = readAll();
    const index = reports.findIndex(r => r.id === id);
    if (index === -1) return null;

    const current = reports[index];
    const now = new Date().toISOString();

    const allowedFields = [
      'issue_title',
      'category',
      'problem_summary',
      'location_json',
      'evidence_json',
      'waste_segregation_breakdown',
      'urgency_level',
      'urgency_details',
      'recommended_actions_json',
      'missing_information',
      'verification_json',
      'complaint_drafts',
      'complaint_subject',
      'complaint_body',
      'complaint_subject_hindi',
      'complaint_body_hindi',
      'status',
      'sla_deadline',
      'endorsements_count',
      'resolution_photo',
      'resolution_notes',
      'resolved_at',
      'submission_details',
    ];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        current[key] = updates[key];
      }
    }

    if (updates.status === 'resolved' && !current.resolved_at) {
      current.resolved_at = now;
    }

    current.updated_at = now;
    reports[index] = current;
    writeAll(reports);
    return current;
  },

  deleteReport(id) {
    const reports = readAll();
    const filtered = reports.filter(r => r.id !== id);
    if (filtered.length === reports.length) return false;
    writeAll(filtered);
    return true;
  },

  seedIfEmpty(seedReports = []) {
    const reports = readAll();
    if (reports.length === 0 && seedReports.length > 0) {
      writeAll(seedReports);
    }
  }
};
