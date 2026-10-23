import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { router as apiRouter } from './routes.js';
import { db } from './db.js';

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Enable CORS for frontend
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) or matching client
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Seed initial reports for demonstration if DB is empty
db.seedIfEmpty([
  {
    id: 'REP-DEMO-BLR-01',
    issue_title: 'Overflowing Municipal Garbage Bin at Indiranagar 12th Main',
    category: 'overflowing_bin',
    problem_summary: 'Secondary waste bin has been overflowing for 3 days with household waste scattering across the pedestrian walkway near Indiranagar Club.',
    input_types: ['text', 'image'],
    location_json: {
      city: 'Bengaluru',
      neighborhood: 'Indiranagar',
      address: 'Near Indiranagar Club, 12th Main Rd, HAL 2nd Stage',
      landmark: 'Opposite Coffee Day Junction',
      source: 'user_provided',
      user_confirmation_required: false
    },
    evidence_json: {
      user_reported_facts: [
        'Waste has not been picked up by the morning auto-tippers for three consecutive days.',
        'Stray animals are pulling plastic bags onto the road creating hazard for two-wheelers.'
      ],
      visible_image_observations: [
        'Green municipal dump bin overflowing with mixed solid domestic waste.',
        'Dispersed litter covering approximately 15 square meters of footpath.'
      ],
      ai_inferences: [
        'High probability of odor complaints and drain choking during rain.',
        'Violation of BBMP SWM By-law Section 7 on secondary bin maintenance.'
      ],
      uncertainties: [
        'Whether door-to-door collection failed for the entire street or only this spot.'
      ]
    },
    urgency_level: 'needs_prompt_attention',
    urgency_details: {
      level: 'needs_prompt_attention',
      reasons: ['Pedestrian obstruction and uncontained organic waste in residential sector.'],
      limitations: ['Assessment based on citizen photograph and description.']
    },
    recommended_actions_json: [
      { step: 1, action: 'Submit grievance to BBMP Sahaaya 2.0 or dial 1533', purpose: 'Logs an official ticket under Karnataka Sakala Services Act (24-hr SLA).' },
      { step: 2, action: 'Notify Ward 89 (Jogupalya) Junior Health Inspector', purpose: 'Directs local pourakarmika beat supervisor to clear the spot.' }
    ],
    missing_information: [],
    verification_json: {
      verification_status: 'verified',
      authority_identified: {
        name: 'Bruhat Bengaluru Mahanagara Palike (BBMP) - Solid Waste Management',
        portal_url: 'https://bbmp.gov.in',
        mobile_app: 'BBMP Sahaaya 2.0',
        helpline: '1533 / 080-22660000',
        established_sla: '24 hours under Sakala Services Act'
      },
      verified_claims: [
        { claim: 'Location falls within BBMP East Zone jurisdiction.', status: 'verified', basis: 'Pin Code 560038 gazetted ward boundaries.' }
      ],
      unverified_claims: [],
      authoritative_sources: [
        {
          source_organization: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
          source_title: 'BBMP SWM Citizen Charter & Grievance Portal',
          official_url: 'https://bbmp.gov.in',
          retrieved_at: new Date().toISOString(),
          confirms: 'Designated municipal authority for Ward 89. Mandates 24-hour clearance of secondary collection points.'
        }
      ],
      disclaimer: 'Jurisdiction and helpline verified against BBMP Citizen Charter.'
    },
    complaint_subject: 'Complaint regarding Overflowing Garbage Bin at Indiranagar 12th Main',
    complaint_body: `To,\nThe Assistant Executive Engineer (SWM) / Junior Health Inspector,\nWard 89, BBMP East Zone, Bengaluru.\n\nSubject: Urgent clearance of overflowing garbage bin at Indiranagar 12th Main\n\nRespected Sir/Madam,\n\nI am writing to draw your urgent attention to an uncollected garbage accumulation at 12th Main Road, near Indiranagar Club. The waste bin has been overflowing for over three days, and refuse is scattered over the footpath.\n\nKindly dispatch a sanitary vehicle to clear the waste and sanitize the spot with disinfectant powder.\n\nThank you,\nConcerned Citizen, Indiranagar Residents Welfare Association`,
    status: 'ready_to_submit',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString()
  }
]);

// Mount API routes
app.use('/api', apiRouter);

// Serve static client assets in production if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// For SPA routing, redirect all non-API requests to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexHtml = path.join(clientDistPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.json({
        name: 'Sahaay AI API',
        tagline: 'From everyday problems to real-world action.',
        status: 'healthy',
        note: 'Build client with npm run build to serve static frontend.'
      });
    }
  });
});

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: `API endpoint ${req.method} ${req.url} not found.` });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` Sahaay AI Server is running on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` Gemini Key status: ${process.env.GEMINI_API_KEY ? 'Configured (Live AI)' : 'Not Set (High-Fidelity Demo Mode)'}`);
  console.log(`======================================================\n`);
});