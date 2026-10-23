import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  FileText,
  Search,
  ExternalLink,
  Phone,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { MunicipalAuthority } from '../types';

interface HowItWorksProps {
  authorities: MunicipalAuthority[];
  onStartReport: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ authorities, onStartReport }) => {
  return (
    <div className="main-content">
      <div className="page-header">
        <h2 className="page-title">How Sahaay AI Works</h2>
        <p className="page-subtitle">
          Bridging the gap between messy everyday citizen complaints and complex Indian municipal systems through structured Gemini intelligence and independent source verification.
        </p>
      </div>

      {/* 5-Step Process Cards */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={20} color="#2563eb" />
          <span>The 5-Step Citizen Resolution Journey</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '0.75rem' }}>
              1
            </div>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>1. Describe the Issue</h4>
            <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
              Speak in your own voice, write in plain words, or snap a photo of overflowing bins, debris, or blocked drains.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '0.75rem' }}>
              2
            </div>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>2. Gemini Analysis</h4>
            <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
              Gemini extracts key facts, classifies waste categories, separates visible evidence from assumptions, and determines urgency.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '0.75rem' }}>
              3
            </div>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>3. Independent Verification</h4>
            <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
              A separate validation engine maps the location to genuine municipal jurisdictions, official helplines, and SWM 2016 rules.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '0.75rem' }}>
              4
            </div>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>4. Review Complaint Draft</h4>
            <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
              Get a ready-to-use, legally framed formal letter with precise statutory references and clear action items.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '0.75rem' }}>
              5
            </div>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>5. Official Resolution</h4>
            <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5 }}>
              Open your city's official 311 portal, paste the pre-formatted complaint, and track your grievance under Citizen Charter SLAs.
            </p>
          </div>
        </div>
      </div>

      {/* Authoritative Municipal Corporation Directory */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={20} color="#2563eb" />
          <span>Authoritative Indian Municipal Channels Directory</span>
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Sahaay AI matches reports strictly against official state and municipal corporation grievance pathways.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>Authority / Corporation</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>Jurisdiction</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>Helpline / App</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>Charter SLA</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155' }}>Official Portal</th>
              </tr>
            </thead>
            <tbody>
              {authorities.map((auth, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                    {auth.name}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                    {auth.jurisdiction}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Phone size={13} color="#2563eb" />
                      <span>{auth.helpline}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{auth.mobile_app}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#166534', fontWeight: 500 }}>
                    {auth.established_sla}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <a
                      href={auth.portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      <span>Portal</span>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trust & AI Ethics Banner */}
      <div className="card" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
          <ShieldCheck size={20} color="#16a34a" />
          <span>Trust, Ethics, and Data Privacy Principles</span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.86rem', color: '#475569', lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
              Transparent Separation of AI Inferences:
            </strong>
            AI models can make errors. Sahaay AI strictly distinguishes between citizen-reported claims, visible photographic observations, and model inferences.
          </div>
          <div>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
              No Fabricated Confirmations:
            </strong>
            We never generate simulated complaint tracking numbers or pretend to have submitted a complaint when an official municipal API is not integrated.
          </div>
          <div>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>
              Privacy & Data Minimization:
            </strong>
            Photographs and GPS coordinates are used exclusively for grievance categorization and are never retained permanently or monetized.
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={onStartReport}>
            Start Reporting a Sanitation Issue
          </button>
        </div>
      </div>
    </div>
  );
};
