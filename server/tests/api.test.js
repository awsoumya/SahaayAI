import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyAuthority, performVerification, MUNICIPAL_AUTHORITIES } from '../src/verification.js';
import { analyzeSanitationIssue } from '../src/gemini.js';
import { db } from '../src/db.js';

test('Verification Engine: correctly identifies Bengaluru authority from location', () => {
  const authority = identifyAuthority({ city: 'Bengaluru', neighborhood: 'Indiranagar' });
  assert.equal(authority.key, 'bengaluru');
  assert.ok(authority.name.includes('BBMP'));
  assert.equal(authority.helpline, '1533 / 080-22660000');
  assert.equal(authority.verified, true);
});

test('Verification Engine: correctly identifies Delhi authority from location', () => {
  const authority = identifyAuthority({ city: 'New Delhi', neighborhood: 'Dwarka' });
  assert.equal(authority.key, 'delhi');
  assert.ok(authority.name.includes('MCD'));
  assert.ok(authority.portal_url.includes('mcdonline.nic.in'));
});

test('Verification Engine: falls back to National Swachhata when city is unspecified', () => {
  const authority = identifyAuthority({});
  assert.equal(authority.key, 'national');
  assert.ok(authority.name.includes('MoHUA'));
  assert.equal(authority.helpline, '1969');
});

test('Verification Engine: generates honest unverified warning when location is missing', () => {
  const verification = performVerification({
    report: {
      observation: {
        user_reported_facts: ['Trash accumulated for days']
      }
    },
    location: {}
  });

  assert.equal(verification.verification_status, 'verification_pending');
  assert.ok(verification.disclaimer.includes('Verification pending'));
  assert.ok(verification.unverified_claims.length > 0);
  assert.ok(verification.authoritative_sources.length > 0);
});

test('Analysis Engine: produces schema-compliant output for Overflowing Bin scenario', async () => {
  const result = await analyzeSanitationIssue({
    text: 'There is an overflowing garbage bin near our apartment. Waste has been lying there for four days, and stray animals are scattering it.',
    location: { city: 'Bengaluru', landmark: 'HAL 2nd Stage' },
    inputType: 'text'
  });

  assert.equal(result.category, 'overflowing_bin');
  assert.ok(result.issue_title.length > 0);
  assert.ok(result.problem_summary.length > 0);
  assert.ok(Array.isArray(result.observation.user_reported_facts));
  assert.ok(Array.isArray(result.observation.ai_inferences));
  assert.ok(Array.isArray(result.observation.uncertainties));
  assert.ok(['routine', 'needs_prompt_attention', 'potentially_urgent'].includes(result.urgency.level));
  assert.ok(result.recommended_actions.length > 0);
  assert.ok(result.complaint_draft.subject.length > 0);
  assert.ok(result.complaint_draft.body.length > 0);
});

test('Analysis Engine: produces schema-compliant output for Illegal Dumping scenario', async () => {
  const result = await analyzeSanitationIssue({
    text: 'Someone keeps dumping construction waste beside the public road near our school. Vehicles and pedestrians are having difficulty passing.',
    location: { city: 'Delhi' },
    inputType: 'text'
  });

  assert.equal(result.category, 'illegal_dumping');
  assert.equal(result.urgency.level, 'potentially_urgent');
  assert.ok(result.observation.ai_inferences.some(inf => inf.includes('Construction & Demolition')));
});

test('Analysis Engine: produces schema-compliant output for Blocked Drainage scenario', async () => {
  const result = await analyzeSanitationIssue({
    text: 'Plastic waste is blocking the drain outside our building. After rain, water accumulates near the entrance.',
    location: { city: 'Mumbai' },
    inputType: 'text'
  });

  assert.equal(result.category, 'blocked_drainage');
  assert.equal(result.urgency.level, 'potentially_urgent');
  assert.ok(result.observation.visible_image_observations !== undefined);
});

test('Persistence Database: handles report creation, retrieval, status update and deletion', () => {
  const created = db.createReport({
    issue_title: 'Unit Test Blocked Drain',
    category: 'blocked_drainage',
    problem_summary: 'Test summary for unit test',
    location: { city: 'Pune' },
    urgency: { level: 'routine', reasons: [], limitations: [] },
    complaint_draft: { subject: 'Test Subject', body: 'Test Body' },
    status: 'draft'
  });

  assert.ok(created.id);
  assert.equal(created.issue_title, 'Unit Test Blocked Drain');

  // Retrieve
  const fetched = db.getReportById(created.id);
  assert.equal(fetched.id, created.id);

  // Update
  const updated = db.updateReport(created.id, { status: 'ready_to_submit' });
  assert.equal(updated.status, 'ready_to_submit');

  // Delete
  const deleted = db.deleteReport(created.id);
  assert.equal(deleted, true);

  // Ensure it no longer exists
  const afterDelete = db.getReportById(created.id);
  assert.equal(afterDelete, null);
});

test('Multi-City Civic Hotspots: database contains verified reports across Indian metros', () => {
  const allReports = db.getAllReports();
  assert.ok(allReports.length >= 7, 'Database should contain multiple multi-city seeded reports');

  const cities = allReports.map(r => r.location_json?.city).filter(Boolean);
  const uniqueCities = new Set(cities.map(c => c.toLowerCase()));

  assert.ok(uniqueCities.has('bengaluru'), 'Should include Bengaluru');
  assert.ok(uniqueCities.has('new delhi') || uniqueCities.has('delhi'), 'Should include Delhi');
  assert.ok(uniqueCities.has('mumbai'), 'Should include Mumbai');
  assert.ok(uniqueCities.has('chennai'), 'Should include Chennai');
  assert.ok(uniqueCities.has('hyderabad'), 'Should include Hyderabad');
  assert.ok(uniqueCities.has('pune'), 'Should include Pune');
  assert.ok(uniqueCities.has('kolkata'), 'Should include Kolkata');
});
