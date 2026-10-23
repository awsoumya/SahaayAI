import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Calendar,
  Camera,
  Check,
  X,
  Share2
} from 'lucide-react';
import { SanitationReport, ReportStatus } from '../types';

interface MyReportsProps {
  reports: SanitationReport[];
  onSelectReport: (report: SanitationReport) => void;
  onUpdateStatus: (id: string, status: ReportStatus, resolutionData?: { photo?: string; notes?: string }) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
  onStartNew: () => void;
}

export const MyReports: React.FC<MyReportsProps> = ({
  reports,
  onSelectReport,
  onUpdateStatus,
  onDeleteReport,
  onStartNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Resolution photo modal state
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [resolutionPhotoPreview, setResolutionPhotoPreview] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.issue_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location?.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location?.neighborhood || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status?: ReportStatus) => {
    switch (status) {
      case 'ready_to_submit':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Ready to Submit</span>;
      case 'submitted':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Submitted</span>;
      case 'resolved':
        return <span className="badge badge-success" style={{ background: '#dcfce7', color: '#14532d' }}><Check size={12} /> Resolved & Verified</span>;
      case 'verification_pending':
        return <span className="badge badge-warning"><Clock size={12} /> Verification Pending</span>;
      case 'needs_more_info':
        return <span className="badge badge-warning"><AlertTriangle size={12} /> Needs More Info</span>;
      default:
        return <span className="badge badge-neutral"><FileText size={12} /> Draft</span>;
    }
  };

  const getSlaPill = (report: SanitationReport) => {
    if (report.status === 'resolved') {
      return (
        <span style={{ fontSize: '0.74rem', background: '#f0fdf4', color: '#166534', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
          ✓ Resolved
        </span>
      );
    }

    const createdTime = report.created_at ? new Date(report.created_at).getTime() : Date.now();
    const slaHours = report.sla_hours || 24;
    const deadline = createdTime + slaHours * 3600 * 1000;
    const diff = deadline - Date.now();

    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      return (
        <span style={{ fontSize: '0.74rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
          ⏳ {hours}h SLA left
        </span>
      );
    } else {
      const overdue = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
      return (
        <span style={{ fontSize: '0.74rem', background: '#fef2f2', color: '#991b1b', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
          ⚠️ Breached +{overdue}h
        </span>
      );
    }
  };

  const handleStatusChange = (id: string, newStatus: ReportStatus) => {
    if (newStatus === 'resolved') {
      setResolvingReportId(id);
    } else {
      onUpdateStatus(id, newStatus);
    }
  };

  const handleSaveResolution = async () => {
    if (!resolvingReportId) return;
    await onUpdateStatus(resolvingReportId, 'resolved', {
      photo: resolutionPhotoPreview || undefined,
      notes: resolutionNotes || undefined,
    });
    setResolvingReportId(null);
    setResolutionPhotoPreview(null);
    setResolutionNotes('');
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="page-title">My Sanitation Reports</h2>
          <p className="page-subtitle">
            Persisted history of citizen reports, verified sources, and official resolution statuses.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onStartNew}>
          + Report New Issue
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', paddingLeft: '32px' }}
              placeholder="Search by title or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select
              className="text-input"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Action Statuses</option>
              <option value="draft">Draft</option>
              <option value="needs_more_info">Needs More Information</option>
              <option value="verification_pending">Verification Pending</option>
              <option value="ready_to_submit">Ready to Submit</option>
              <option value="submitted">Submitted</option>
              <option value="resolved">Resolved & Verified</option>
            </select>
          </div>

          <div>
            <select
              className="text-input"
              style={{ width: '100%' }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="overflowing_bin">Overflowing Bins</option>
              <option value="uncollected_garbage">Uncollected Garbage</option>
              <option value="illegal_dumping">Illegal Dumping</option>
              <option value="blocked_drainage">Blocked Drainage</option>
              <option value="waste_near_sensitive_zone">Near Sensitive Zones</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <FileText size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            No reports found
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your search criteria or clearing filters.'
              : 'You have not submitted or saved any sanitation reports yet.'}
          </p>
          <button className="btn btn-primary" onClick={onStartNew}>
            Report an Issue Now
          </button>
        </div>
      ) : (
        <div className="reports-grid">
          {filteredReports.map((item) => (
            <div key={item.id} className="report-item-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span className="category-tag">{item.category?.replace('_', ' ')}</span>
                  <h3
                    style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', cursor: 'pointer', marginTop: '0.25rem' }}
                    onClick={() => onSelectReport(item)}
                  >
                    {item.issue_title}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {getSlaPill(item)}
                  {getStatusBadge(item.status)}
                </div>
              </div>

              <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
                {item.problem_summary}
              </p>

              {/* If resolution photo exists */}
              {item.resolution_photo && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Resolution photo verified on {item.resolved_at ? new Date(item.resolved_at).toLocaleDateString('en-IN') : 'recently'}. Area successfully cleared!</span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.82rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={13} color="#2563eb" />
                  <span>
                    {[item.location?.neighborhood, item.location?.city].filter(Boolean).join(', ') || 'Location not confirmed'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} />
                  <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : 'Recent'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ShieldCheck size={13} color="#16a34a" />
                  <span>{item.verification?.authority_identified?.name ? 'Channel Verified' : 'Standard Directory'}</span>
                </div>
              </div>

              {/* Status Updater & Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Update Status:</span>
                  <select
                    className="text-input"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', height: '30px' }}
                    value={item.status || 'draft'}
                    onChange={(e) => {
                      if (item.id) handleStatusChange(item.id, e.target.value as ReportStatus);
                    }}
                  >
                    <option value="draft">Draft</option>
                    <option value="needs_more_info">Needs More Info</option>
                    <option value="verification_pending">Verification Pending</option>
                    <option value="ready_to_submit">Ready to Submit</option>
                    <option value="submitted">Submitted</option>
                    <option value="resolved">Resolved & Verified</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onSelectReport(item)}
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
                  >
                    View & Edit Details
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (item.id && confirm('Are you sure you want to delete this report record?')) {
                        onDeleteReport(item.id);
                      }
                    }}
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.55rem', color: '#dc2626' }}
                    title="Delete report"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution Photo Upload Modal */}
      {resolvingReportId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={22} color="#16a34a" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Mark Issue as Resolved</h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingReportId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', marginBottom: '1rem' }}>
              To ensure civic accountability, you can attach a photo proving the waste has been removed and the area cleaned.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Attach Resolution Photo (optional):</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (event) => setResolutionPhotoPreview(event.target?.result as string);
                    reader.readAsDataURL(e.target.files[0]);
                  }
                }}
              />
              {resolutionPhotoPreview && (
                <div style={{ marginTop: '0.5rem', maxWidth: '200px' }}>
                  <img src={resolutionPhotoPreview} alt="Resolution" style={{ width: '100%', borderRadius: '6px' }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Resolution Notes / Inspection Remarks:</label>
              <textarea
                className="textarea-field"
                style={{ minHeight: '70px' }}
                placeholder="e.g. Cleared by BBMP auto tipper crew this morning. Disinfectant applied."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setResolvingReportId(null)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleSaveResolution}>
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
