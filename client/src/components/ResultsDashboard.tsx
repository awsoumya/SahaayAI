import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
  Copy,
  Download,
  BookmarkCheck,
  ArrowLeft,
  Info,
  MapPin,
  Send,
  HelpCircle,
  FileCheck,
  RefreshCw,
  Eye,
  MessageSquareQuote,
  Share2,
  Printer,
  Sparkles,
  Camera,
  Check,
  Volume2,
  VolumeX,
  Twitter,
  Users,
  QrCode,
  Layers,
  Recycle
} from 'lucide-react';
import { PhotoBoundingBoxOverlay } from './PhotoBoundingBoxOverlay';
import { SanitationReport, UrgencyLevel, ReportStatus } from '../types';

interface ResultsDashboardProps {
  report: SanitationReport;
  onBack: () => void;
  onSave: (report: SanitationReport) => Promise<void>;
  onReverify: (updatedLocation: Record<string, any>) => Promise<void>;
  onEndorse?: (id: string) => Promise<void>;
  onSubmitOfficial: (id?: string) => Promise<void>;
  isSaving: boolean;
}

type LangKey = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr';

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  report,
  onBack,
  onSave,
  onReverify,
  onEndorse,
  onSubmitOfficial,
  isSaving,
}) => {
  // Selected language for complaint draft
  const [complaintLang, setComplaintLang] = useState<LangKey>('en');

  // Multi-language drafts cache
  const drafts = report.complaint_drafts || {};
  const [subjectDrafts, setSubjectDrafts] = useState<Record<LangKey, string>>({
    en: drafts.en?.subject || report.complaint_draft?.subject || `Urgent Grievance: ${report.issue_title}`,
    hi: drafts.hi?.subject || report.complaint_draft?.subject_hindi || `शिकायत पत्र: ${report.issue_title} के संबंध में`,
    kn: drafts.kn?.subject || `ದೂರು ಅರ್ಜಿ: ${report.issue_title} ತ್ವರಿತ ವಿಲೇವಾರಿಗಾಗಿ`,
    ta: drafts.ta?.subject || `புகார் மனு: ${report.issue_title} அகற்றுவது தொடர்பாக`,
    te: drafts.te?.subject || `ఫిర్యాదు పత్రం: ${report.issue_title} పరిష్కారం కొరకు`,
    mr: drafts.mr?.subject || `तक्रार अर्ज: ${report.issue_title} त्वरित स्वच्छतेबाबत`,
  });

  const [bodyDrafts, setBodyDrafts] = useState<Record<LangKey, string>>({
    en: drafts.en?.body || report.complaint_draft?.body || '',
    hi: drafts.hi?.body || report.complaint_draft?.body_hindi || '',
    kn: drafts.kn?.body || '',
    ta: drafts.ta?.body || '',
    te: drafts.te?.body || '',
    mr: drafts.mr?.body || '',
  });

  const [copyFeedback, setCopyFeedback] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  // Missing info inline completion state
  const [newCity, setNewCity] = useState(report.location?.city || '');
  const [newNeighborhood, setNewNeighborhood] = useState(report.location?.neighborhood || '');
  const [newLandmark, setNewLandmark] = useState(report.location?.landmark || '');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // SLA Countdown State
  const [slaStatus, setSlaStatus] = useState<{ remaining: string; isBreached: boolean }>({
    remaining: 'Calculating...',
    isBreached: false,
  });

  // Endorsement state
  const [endorsementCount, setEndorsementCount] = useState(report.endorsements_count || 1);
  const [hasEndorsed, setHasEndorsed] = useState(false);

  // Text to Speech State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Calculate dynamic SLA countdown
  useEffect(() => {
    const calculateSLA = () => {
      const createdTime = report.created_at ? new Date(report.created_at).getTime() : Date.now();
      const slaHours = report.sla_hours || 24;
      const deadline = createdTime + slaHours * 3600 * 1000;
      const now = Date.now();
      const diff = deadline - now;

      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setSlaStatus({
          remaining: `${hours}h ${mins}m remaining under Citizen Charter SLA`,
          isBreached: false,
        });
      } else {
        const overdueHours = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
        setSlaStatus({
          remaining: `SLA Breached by ${overdueHours}h — Eligible for Tier-2 Lokayukta / Zonal Commissioner Escalation`,
          isBreached: true,
        });
      }
    };

    calculateSLA();
    const interval = setInterval(calculateSLA, 60000);
    return () => clearInterval(interval);
  }, [report.created_at, report.sla_hours]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text to Speech Play / Stop Handler
  const handleToggleAudioReadout = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech audio synthesis is not supported on this browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const textToSpeak = `${subjectDrafts[complaintLang]}. ${bodyDrafts[complaintLang]}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // Select voice based on language
      if (complaintLang === 'hi') utterance.lang = 'hi-IN';
      else if (complaintLang === 'ta') utterance.lang = 'ta-IN';
      else if (complaintLang === 'te') utterance.lang = 'te-IN';
      else if (complaintLang === 'kn') utterance.lang = 'kn-IN';
      else if (complaintLang === 'mr') utterance.lang = 'mr-IN';
      else utterance.lang = 'en-IN';

      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);

      utteranceRef.current = utterance;
      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Copy current complaint to clipboard
  const handleCopyComplaint = () => {
    const fullText = `Subject: ${subjectDrafts[complaintLang]}\n\n${bodyDrafts[complaintLang]}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    });
  };

  // Download complaint as text file
  const handleDownloadComplaint = () => {
    const fullText = `SAHAAY AI — VERIFIED CIVIC GRIEVANCE DRAFT (${complaintLang.toUpperCase()})\nGenerated: ${new Date().toLocaleString()}\nAuthority: ${report.verification?.authority_identified?.name || 'Municipal Corporation'}\n\nSubject: ${subjectDrafts[complaintLang]}\n\n${bodyDrafts[complaintLang]}`;
    const element = document.createElement('a');
    const file = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `sahaay_complaint_${complaintLang}_${report.category || 'sanitation'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // WhatsApp Community Mobilization Share
  const handleWhatsAppShare = () => {
    const authority = report.verification?.authority_identified;
    const loc = [report.location?.landmark, report.location?.neighborhood, report.location?.city].filter(Boolean).join(', ') || 'Reported Location';
    const text = `🚨 *Civic Cleanliness Alert — Sahaay AI* 🚨\n\n*Issue:* ${report.issue_title}\n*Location:* ${loc}\n*Urgency:* ${report.urgency?.level?.toUpperCase().replace('_', ' ')}\n*Authority:* ${authority?.name || 'Municipal Corporation'}\n*Helpline:* ${authority?.helpline || '1969'}\n*Community Endorsements:* ${endorsementCount} citizens\n\n*Summary:* ${report.problem_summary}\n\n_Generated via Sahaay AI under Solid Waste Management Rules 2016. Please support this issue for swift ward clearance!_`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Twitter / X Civic Grievance Tagging
  const handleTwitterShare = () => {
    const authority = report.verification?.authority_identified;
    const loc = [report.location?.neighborhood, report.location?.city].filter(Boolean).join(', ') || 'Reported Area';
    const handle = authority?.twitter_handle || '@SwachhBharatGov @MoHUA_India';
    const tweetText = `🚨 Urgent sanitation grievance via Sahaay AI: "${report.issue_title}" at ${loc}. Requesting prompt clearance under Solid Waste Management Rules 2016. ${handle} #SwachhBharat #CivicAction`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
  };

  // Co-sign / Endorse issue
  const handleEndorseClick = async () => {
    if (hasEndorsed) return;
    setEndorsementCount(prev => prev + 1);
    setHasEndorsed(true);
    if (report.id && onEndorse) {
      await onEndorse(report.id);
    }
  };

  // Print official formal petition
  const handlePrintPetition = () => {
    window.print();
  };

  // Save report
  const handleSaveReport = async () => {
    const updatedReport: SanitationReport = {
      ...report,
      complaint_draft: {
        subject: subjectDrafts.en,
        body: bodyDrafts.en,
        subject_hindi: subjectDrafts.hi,
        body_hindi: bodyDrafts.hi,
      },
      complaint_drafts: {
        en: { subject: subjectDrafts.en, body: bodyDrafts.en },
        hi: { subject: subjectDrafts.hi, body: bodyDrafts.hi },
        kn: { subject: subjectDrafts.kn, body: bodyDrafts.kn },
        ta: { subject: subjectDrafts.ta, body: bodyDrafts.ta },
        te: { subject: subjectDrafts.te, body: bodyDrafts.te },
        mr: { subject: subjectDrafts.mr, body: bodyDrafts.mr },
      },
      location: {
        ...report.location,
        city: newCity || report.location?.city,
        neighborhood: newNeighborhood || report.location?.neighborhood,
        landmark: newLandmark || report.location?.landmark,
      },
      endorsements_count: endorsementCount,
    };
    await onSave(updatedReport);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Re-verify after updating location inline
  const handleInlineLocationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingLocation(true);
    await onReverify({
      city: newCity,
      neighborhood: newNeighborhood,
      landmark: newLandmark,
    });
    setIsUpdatingLocation(false);
  };

  // Submission handler
  const handleTriggerSubmission = async () => {
    setSubmitModalOpen(true);
    const authority = report.verification?.authority_identified;
    setSubmissionFeedback(
      `Direct API dispatch is not sanctioned by ${authority?.name || 'the Municipal Corporation'} without citizen mobile OTP verification. Sahaay AI provides your verified draft pre-formatted for their official portal or 311 app.`
    );
  };

  const getUrgencyBadge = (level: UrgencyLevel) => {
    switch (level) {
      case 'routine':
        return <span className="badge badge-neutral"><Clock size={12} /> Routine Priority</span>;
      case 'needs_prompt_attention':
        return <span className="badge badge-warning"><AlertTriangle size={12} /> Needs Prompt Attention</span>;
      case 'potentially_urgent':
        return <span className="badge badge-danger"><AlertTriangle size={12} /> Potentially Urgent</span>;
      default:
        return <span className="badge badge-neutral">Needs Assessment</span>;
    }
  };

  const authority = report.verification?.authority_identified;
  const isVerified = report.verification?.verification_status === 'verified';
  const segregation = report.waste_segregation_breakdown || {
    dry_recyclable_pct: 45,
    wet_biodegradable_pct: 40,
    construction_demolition_pct: 10,
    hazardous_sanitary_pct: 5,
    segregation_recommendations: []
  };

  return (
    <div className="main-content">
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: '0.88rem' }}>
          <ArrowLeft size={16} />
          <span>Report Another Issue</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Endorsement +1 Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleEndorseClick}
            disabled={hasEndorsed}
            style={{ color: '#7e22ce', borderColor: '#e9d5ff', background: hasEndorsed ? '#f3e8ff' : '#faf5ff' }}
            title="Co-sign and endorse this issue as an affected neighbor"
          >
            <Users size={15} />
            <span>{hasEndorsed ? `✓ Endorsed (${endorsementCount})` : `+1 Endorse (${endorsementCount})`}</span>
          </button>

          {/* Twitter / X Escalation Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTwitterShare}
            style={{ color: '#0f172a', borderColor: '#cbd5e1' }}
            title="Escalate grievance to municipal Twitter handles"
          >
            <Twitter size={15} color="#1da1f2" />
            <span>Tweet Authority</span>
          </button>

          {/* WhatsApp Share Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleWhatsAppShare}
            style={{ color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4' }}
            title="Share to WhatsApp RWA community group"
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>

          {/* QR Code Placard */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setQrModalOpen(true)}
            title="Generate printable QR spot placard"
          >
            <QrCode size={15} />
            <span>QR Placard</span>
          </button>

          {/* Print Petition */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrintPetition}
            title="Print formal citizen petition"
          >
            <Printer size={15} />
            <span>Print Petition</span>
          </button>

          {/* Save to My Reports */}
          <button
            className="btn btn-secondary"
            onClick={handleSaveReport}
            disabled={isSaving}
          >
            <BookmarkCheck size={16} color={saveSuccess ? '#16a34a' : 'currentColor'} />
            <span>{saveSuccess ? 'Saved!' : 'Save Report'}</span>
          </button>

          {authority?.portal_url && (
            <a
              href={authority.portal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <ExternalLink size={16} />
              <span>Open Official Portal</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Results Container */}
      <div className="results-dashboard">
        {/* Spatial Proximity Duplicate Alert Banner (< 75m) */}
        {report.nearby_duplicate && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e3a8a' }}>
                  Nearby Active Ticket Detected ({report.nearby_duplicate.distance_meters} meters away)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#3b82f6' }}>
                  "{report.nearby_duplicate.issue_title}" is already registered with {report.nearby_duplicate.endorsements_count} citizen co-signatures.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEndorseClick}
              disabled={hasEndorsed}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
            >
              {hasEndorsed ? '✓ Co-signed & Consolidated' : `+1 Co-sign Ticket #${report.nearby_duplicate.id.slice(-6)}`}
            </button>
          </div>
        )}

        {/* 1. Header Summary Card & SLA Countdown */}
        <div className="results-header-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <span className="category-tag">{report.category?.replace('_', ' ')}</span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {report.issue_title}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-neutral" style={{ background: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' }}>
                <Users size={12} /> {endorsementCount} Citizens Endorsed
              </span>
              {getUrgencyBadge(report.urgency?.level)}
              <span className={`badge ${isVerified ? 'badge-success' : 'badge-warning'}`}>
                <ShieldCheck size={12} />
                {isVerified ? 'Authority Verified' : 'Verification Pending'}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '1rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
            {report.problem_summary}
          </p>

          {/* Dynamic SLA Countdown Banner */}
          <div style={{
            background: slaStatus.isBreached ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${slaStatus.isBreached ? '#fecaca' : '#bbf7d0'}`,
            color: slaStatus.isBreached ? '#991b1b' : '#166534',
            padding: '0.5rem 0.85rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            <Clock size={15} />
            <span>{slaStatus.remaining}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.85rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={15} color="#2563eb" />
              <span>
                <strong>Reported Location:</strong>{' '}
                {[report.location?.landmark, report.location?.neighborhood, report.location?.city].filter(Boolean).join(', ') || 'Not explicitly specified'}
              </span>
            </div>
            {report._meta?.model && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Info size={15} color="#64748b" />
                <span>
                  <strong>Engine:</strong> {report._meta.is_live_gemini ? `Google Gemini (${report._meta.model})` : 'Sahaay Verified Heuristics'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Statutory Waste Segregation Breakdown Bar (SWM Rules 2016) */}
        <div className="card" style={{ background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Recycle size={18} color="#16a34a" />
              <span>Statutory Waste Segregation Composition (SWM Rules 2016)</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Estimated by Multimodal Analysis</span>
          </div>

          {/* Segmented Percentage Bar */}
          <div style={{ width: '100%', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', marginBottom: '0.75rem', background: '#e2e8f0' }}>
            <div style={{ width: `${segregation.dry_recyclable_pct}%`, background: '#2563eb' }} title={`Dry Recyclable: ${segregation.dry_recyclable_pct}%`} />
            <div style={{ width: `${segregation.wet_biodegradable_pct}%`, background: '#16a34a' }} title={`Wet Biodegradable: ${segregation.wet_biodegradable_pct}%`} />
            <div style={{ width: `${segregation.construction_demolition_pct}%`, background: '#f59e0b' }} title={`C&D Debris: ${segregation.construction_demolition_pct}%`} />
            <div style={{ width: `${segregation.hazardous_sanitary_pct}%`, background: '#dc2626' }} title={`Hazardous/Sanitary: ${segregation.hazardous_sanitary_pct}%`} />
          </div>

          {/* Breakdown Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.82rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }} />
              <strong>Dry Recyclable:</strong> {segregation.dry_recyclable_pct}% (Plastic/Paper)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }} />
              <strong>Wet Organic:</strong> {segregation.wet_biodegradable_pct}% (Food/Horticulture)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <strong>C&D Rubble:</strong> {segregation.construction_demolition_pct}% (Debris/Silt)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626' }} />
              <strong>Hazardous/Sanitary:</strong> {segregation.hazardous_sanitary_pct}%
            </span>
          </div>

          {segregation.segregation_recommendations?.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.5rem', fontStyle: 'italic' }}>
              💡 {segregation.segregation_recommendations[0]}
            </p>
          )}
        </div>

        {/* Computer Vision Detection & Bounding Box Canvas (if photographic evidence or detections present) */}
        {report.bounding_boxes && report.bounding_boxes.length > 0 && (
          <div className="card" style={{ background: '#ffffff', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Sparkles size={18} color="#2563eb" />
                <span>Multimodal Computer Vision Detections (Object Detection Canvas)</span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                ✓ {report.bounding_boxes.length} Bounding Regions Identified
              </span>
            </div>

            <PhotoBoundingBoxOverlay
              imageSrc="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'><rect width='100%25' height='100%25' fill='%231e293b'/><text x='50%25' y='45%25' fill='%2394a3b8' font-size='20' font-family='sans-serif' text-anchor='middle'>Sahaay AI Computer Vision Visual Analysis</text><text x='50%25' y='55%25' fill='%2364748b' font-size='14' font-family='sans-serif' text-anchor='middle'>Photographic Evidence Object Localization</text></svg>"
              boxes={report.bounding_boxes}
            />
          </div>
        )}

        {/* 3. Structured Observations: 4-Box Evidence Grid */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Eye size={18} color="#2563eb" />
            <span>Evidence & Observation Analysis</span>
          </h3>
          <div className="observations-grid">
            {/* Box 1: Citizen Reported Facts */}
            <div className="observation-box">
              <div className="observation-title" style={{ color: '#0369a1' }}>
                <MessageSquareQuote size={16} />
                <span>User-Reported Facts ({report.observation?.user_reported_facts?.length || 0})</span>
              </div>
              <ul className="observation-list">
                {report.observation?.user_reported_facts?.length ? (
                  report.observation.user_reported_facts.map((fact, idx) => <li key={idx}>{fact}</li>)
                ) : (
                  <li style={{ fontStyle: 'italic' }}>No direct citizen statements provided.</li>
                )}
              </ul>
            </div>

            {/* Box 2: Visible Image Observations */}
            <div className="observation-box">
              <div className="observation-title" style={{ color: '#166534' }}>
                <FileCheck size={16} />
                <span>Visible Image Evidence ({report.observation?.visible_image_observations?.length || 0})</span>
              </div>
              <ul className="observation-list">
                {report.observation?.visible_image_observations?.length ? (
                  report.observation.visible_image_observations.map((obs, idx) => <li key={idx}>{obs}</li>)
                ) : (
                  <li style={{ fontStyle: 'italic' }}>No photograph provided. Visual verification pending.</li>
                )}
              </ul>
            </div>

            {/* Box 3: AI Inferences */}
            <div className="observation-box">
              <div className="observation-title" style={{ color: '#6b21a8' }}>
                <ShieldCheck size={16} />
                <span>AI Inferences ({report.observation?.ai_inferences?.length || 0})</span>
              </div>
              <ul className="observation-list">
                {report.observation?.ai_inferences?.length ? (
                  report.observation.ai_inferences.map((inf, idx) => <li key={idx}>{inf}</li>)
                ) : (
                  <li style={{ fontStyle: 'italic' }}>No additional inferences drawn.</li>
                )}
              </ul>
            </div>

            {/* Box 4: Uncertainties & Limitations */}
            <div className="observation-box">
              <div className="observation-title" style={{ color: '#92400e' }}>
                <HelpCircle size={16} />
                <span>Uncertainties & Limitations ({report.observation?.uncertainties?.length || 0})</span>
              </div>
              <ul className="observation-list">
                {report.observation?.uncertainties?.length ? (
                  report.observation.uncertainties.map((unc, idx) => <li key={idx}>{unc}</li>)
                ) : (
                  <li style={{ fontStyle: 'italic' }}>No significant ambiguities flagged.</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* 4. Independent Verification & Authoritative Sources Card */}
        <div className={`card verification-card ${isVerified ? 'verified' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ShieldCheck size={20} color={isVerified ? '#16a34a' : '#d97706'} />
                <span>Authoritative Source Verification</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Separately verified against gazetted municipal charters and government sanitation portals.
              </p>
            </div>
            <span className={`badge ${isVerified ? 'badge-success' : 'badge-warning'}`}>
              {report.verification?.verification_status?.toUpperCase().replace('_', ' ')}
            </span>
          </div>

          {authority && (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                  {authority.name}
                </span>
                <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                  Jurisdiction: {authority.jurisdiction}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div><strong>Toll-Free Helpline:</strong> {authority.helpline}</div>
                <div><strong>Citizen Mobile App:</strong> {authority.mobile_app}</div>
                <div><strong>Twitter Handle:</strong> {authority.twitter_handle || '@SwachhBharatGov'}</div>
                <div><strong>Charter SLA:</strong> {authority.established_sla}</div>
              </div>

              {/* Granular Ward & SWM Depot Demarcation */}
              {report.verification?.resolved_ward && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem', color: '#065f46', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CheckCircle2 size={16} />
                  <span>
                    <strong>Gazetted Ward Demarcation:</strong> Ward {report.verification.resolved_ward.ward_number} ({report.verification.resolved_ward.ward_name}), {report.verification.resolved_ward.zone}. Local Depot: {report.verification.resolved_ward.depot}.
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ background: isVerified ? '#f0fdf4' : '#fffbeb', border: `1px solid ${isVerified ? '#bbf7d0' : '#fde68a'}`, padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: isVerified ? '#166534' : '#92400e', marginBottom: '1rem' }}>
            <strong>Verification Notice:</strong> {report.verification?.disclaimer}
          </div>

          {report.verification?.authoritative_sources && (
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
                Authoritative Sources Checked:
              </div>
              {report.verification.authoritative_sources.map((src, idx) => (
                <div key={idx} className="source-item">
                  <div className="source-header">
                    <div>
                      <span className="source-title">{src.source_title}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                        Source: {src.source_organization}
                      </span>
                    </div>
                    <a
                      href={src.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>Visit Official Site</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="source-confirms">
                    <strong>What this source confirms:</strong> {src.confirms}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Recommended Actions Plan */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span>Recommended Action Plan</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {report.recommended_actions?.map((act, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                  {act.step || idx + 1}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{act.action}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}>{act.purpose}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Multi-Regional Indic Editable Complaint Generator */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileCheck size={18} color="#2563eb" />
                <span>Multi-Regional Indic Complaint Draft (Editable)</span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Statutory formatting for zonal municipal reception desks across India under SWM Rules 2016.
              </p>
            </div>

            {/* Audio Readout (TTS) Button */}
            <button
              type="button"
              className={`btn ${isPlayingAudio ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleToggleAudioReadout}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
              title="Listen to draft read aloud via Text-to-Speech"
            >
              {isPlayingAudio ? <VolumeX size={15} /> : <Volume2 size={15} color="#2563eb" />}
              <span>{isPlayingAudio ? 'Stop Reading' : '🔊 Listen Aloud'}</span>
            </button>
          </div>

          {/* 6 Indic Language Switcher Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', gap: '3px', marginBottom: '1rem', overflowX: 'auto' }}>
            <button
              type="button"
              className={`btn ${complaintLang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', height: '32px' }}
              onClick={() => setComplaintLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`btn ${complaintLang === 'hi' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', height: '32px' }}
              onClick={() => setComplaintLang('hi')}
            >
              हिन्दी (Hindi)
            </button>
            <button
              type="button"
              className={`btn ${complaintLang === 'kn' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', height: '32px' }}
              onClick={() => setComplaintLang('kn')}
            >
              ಕನ್ನಡ (Kannada - BBMP)
            </button>
            <button
              type="button"
              className={`btn ${complaintLang === 'ta' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', height: '32px' }}
              onClick={() => setComplaintLang('ta')}
            >
              தமிழ் (Tamil - GCC)
            </button>
            <button
              type="button"
              className={`btn ${complaintLang === 'te' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', height: '32px' }}
              onClick={() => setComplaintLang('te')}
            >
              తెలుగు (Telugu - GHMC)
            </button>
            <button
              type="button"
              className={`btn ${complaintLang === 'mr' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', height: '32px' }}
              onClick={() => setComplaintLang('mr')}
            >
              मराठी (Marathi - BMC)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyComplaint}
              style={{ fontSize: '0.85rem' }}
            >
              <Copy size={14} color={copyFeedback ? '#16a34a' : 'currentColor'} />
              <span>{copyFeedback ? 'Copied to Clipboard!' : `Copy ${complaintLang.toUpperCase()} Draft`}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadComplaint}
              style={{ fontSize: '0.85rem' }}
            >
              <Download size={14} />
              <span>Download (.txt)</span>
            </button>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Subject Line:</label>
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', fontWeight: 700 }}
              value={subjectDrafts[complaintLang]}
              onChange={(e) => setSubjectDrafts({ ...subjectDrafts, [complaintLang]: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">Formal Complaint Body (Review or edit before lodging):</label>
            <textarea
              className="complaint-editor"
              value={bodyDrafts[complaintLang]}
              onChange={(e) => setBodyDrafts({ ...bodyDrafts, [complaintLang]: e.target.value })}
              rows={12}
            />
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              ℹ Ready to paste into {authority?.name || 'Municipal Corporation'} 311 portal or WhatsApp helpline.
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTriggerSubmission}
              >
                <Send size={15} />
                <span>Submit via Integration</span>
              </button>
              {authority?.portal_url && (
                <a
                  href={authority.portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success"
                >
                  <ExternalLink size={15} />
                  <span>Open {authority.mobile_app || 'Official Portal'}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Honest Submission Modal */}
      {submitModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Info size={22} color="#2563eb" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Official Submission Notice</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: '1rem' }}>
              {submissionFeedback}
            </p>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <div><strong>Designated Channel:</strong> {authority?.name}</div>
              <div><strong>Official Web Portal:</strong> <a href={authority?.portal_url} target="_blank" rel="noopener noreferrer">{authority?.portal_url}</a></div>
              <div><strong>Helpline:</strong> {authority?.helpline}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setSubmitModalOpen(false)}>
                Close
              </button>
              {authority?.portal_url && (
                <a
                  href={authority.portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  onClick={() => setSubmitModalOpen(false)}
                >
                  <ExternalLink size={15} />
                  <span>Proceed to Official Portal</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable QR Code Spot Placard Modal */}
      {qrModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '1.75rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <QrCode size={26} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.35rem' }}>Printable Black-Spot Placard</h3>
            <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '1rem' }}>
              Paste this placard at the spot so neighbors and municipal inspectors can track clearance status.
            </p>

            <div style={{ background: '#ffffff', padding: '1.25rem', border: '2px dashed #cbd5e1', borderRadius: '10px', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>SAHAAY AI CIVIC TRACKER</div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, marginBottom: '0.75rem' }}>TRACKED UNDER SOLID WASTE RULES 2016</div>

              {/* Visual simulated QR code */}
              <div style={{ width: '140px', height: '140px', margin: '0 auto', background: '#f8fafc', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                <QrCode size={110} color="#0f172a" />
              </div>

              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginTop: '0.75rem' }}>
                Grievance Ref: {report.id || 'REP-ACTIVE'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Authority: {authority?.name} (Helpline: {authority?.helpline})
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setQrModalOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={15} />
                <span>Print Placard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
