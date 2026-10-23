import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { ResultsDashboard } from './components/ResultsDashboard';
import { MyReports } from './components/MyReports';
import { CommunityHotspotsMap } from './components/CommunityHotspotsMap';
import { HowItWorks } from './components/HowItWorks';
import {
  checkBackendHealth,
  getAuthorities,
  analyzeSanitationIssue,
  verifyClaims,
  saveReport,
  fetchAllReports,
  updateReport,
  deleteReport,
  endorseReport,
  submitReportToOfficial,
} from './services/api';
import {
  BackendHealth,
  MunicipalAuthority,
  SanitationReport,
  ReportStatus,
  LocationData,
} from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'report' | 'hotspots' | 'my-reports' | 'how-it-works' | 'results'>('report');
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [authorities, setAuthorities] = useState<MunicipalAuthority[]>([]);
  const [savedReports, setSavedReports] = useState<SanitationReport[]>([]);
  const [currentReport, setCurrentReport] = useState<SanitationReport | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize application data
  useEffect(() => {
    async function init() {
      try {
        const healthData = await checkBackendHealth();
        setHealth(healthData);
      } catch (err) {
        console.warn('Backend health check warning:', err);
      }

      try {
        const authData = await getAuthorities();
        setAuthorities(authData);
      } catch (err) {
        console.warn('Could not fetch authorities:', err);
      }

      try {
        const reportsData = await fetchAllReports();
        setSavedReports(reportsData);
      } catch (err) {
        console.warn('Could not fetch saved reports:', err);
      }
    }

    init();
  }, []);

  // Handler for analyzing issue
  const handleAnalyze = async (payload: {
    text: string;
    imageFile: File | null;
    audioFile: File | null;
    location: LocationData;
    inputType: 'text' | 'voice' | 'image';
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const analyzed = await analyzeSanitationIssue({
        text: payload.text,
        imageFile: payload.imageFile,
        audioFile: payload.audioFile,
        location: payload.location,
        inputType: payload.inputType,
      });

      setCurrentReport(analyzed);
      setCurrentTab('results');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'An error occurred while analyzing the issue.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for saving report
  const handleSaveReport = async (reportToSave: SanitationReport) => {
    setIsSaving(true);
    try {
      const saved = await saveReport(reportToSave);
      const refreshed = await fetchAllReports();
      setSavedReports(refreshed);
      setCurrentReport(saved);
    } catch (err: any) {
      alert(`Could not save report: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for reverifying with new location info
  const handleReverify = async (updatedLocation: Record<string, any>) => {
    if (!currentReport) return;
    try {
      const reverified = await verifyClaims(currentReport, updatedLocation);
      setCurrentReport((prev) =>
        prev
          ? {
              ...prev,
              location: {
                ...prev.location,
                ...updatedLocation,
                user_confirmation_required: false,
              },
              verification: reverified,
            }
          : null
      );
    } catch (err: any) {
      alert(`Re-verification failed: ${err.message}`);
    }
  };

  // Handler for updating status in My Reports with optional resolution proof
  const handleUpdateStatus = async (
    id: string,
    status: ReportStatus,
    resolutionData?: { photo?: string; notes?: string }
  ) => {
    try {
      const updates: any = { status };
      if (resolutionData?.photo) updates.resolution_photo = resolutionData.photo;
      if (resolutionData?.notes) updates.resolution_notes = resolutionData.notes;

      await updateReport(id, updates);
      const refreshed = await fetchAllReports();
      setSavedReports(refreshed);
    } catch (err: any) {
      alert(`Failed to update report status: ${err.message}`);
    }
  };

  // Handler for endorsing an issue (+1 community endorsement)
  const handleEndorse = async (id: string) => {
    try {
      await endorseReport(id);
      const refreshed = await fetchAllReports();
      setSavedReports(refreshed);
    } catch (err: any) {
      console.warn('Endorsement warning:', err.message);
    }
  };

  // Handler for deleting report
  const handleDeleteReport = async (id: string) => {
    try {
      await deleteReport(id);
      const refreshed = await fetchAllReports();
      setSavedReports(refreshed);
      if (currentReport?.id === id) {
        setCurrentReport(null);
      }
    } catch (err: any) {
      alert(`Failed to delete report: ${err.message}`);
    }
  };

  // Handler for selecting an existing report to view
  const handleSelectReport = (report: SanitationReport) => {
    setCurrentReport(report);
    setCurrentTab('results');
  };

  // Handler for official submission attempt
  const handleSubmitOfficial = async (id?: string) => {
    if (!id && currentReport?.id) {
      id = currentReport.id;
    }
    if (id) {
      await submitReportToOfficial(id);
    }
  };

  return (
    <div className="app-container">
      <Header
        currentTab={currentTab === 'results' ? 'report' : currentTab}
        onSelectTab={(tab) => {
          setError(null);
          setCurrentTab(tab);
        }}
        reportCount={savedReports.length}
        health={health}
      />

      <main style={{ flex: 1 }}>
        {currentTab === 'report' && (
          <MainDashboard
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            error={error}
          />
        )}

        {currentTab === 'hotspots' && (
          <CommunityHotspotsMap
            reports={savedReports}
            onSelectReport={handleSelectReport}
            onEndorse={handleEndorse}
            onStartNew={() => setCurrentTab('report')}
          />
        )}

        {currentTab === 'results' && currentReport && (
          <ResultsDashboard
            report={currentReport}
            onBack={() => setCurrentTab('report')}
            onSave={handleSaveReport}
            onReverify={handleReverify}
            onEndorse={handleEndorse}
            onSubmitOfficial={handleSubmitOfficial}
            isSaving={isSaving}
          />
        )}

        {currentTab === 'my-reports' && (
          <MyReports
            reports={savedReports}
            onSelectReport={handleSelectReport}
            onUpdateStatus={handleUpdateStatus}
            onDeleteReport={handleDeleteReport}
            onStartNew={() => {
              setCurrentTab('report');
            }}
          />
        )}

        {currentTab === 'how-it-works' && (
          <HowItWorks
            authorities={authorities}
            onStartReport={() => setCurrentTab('report')}
          />
        )}
      </main>

      {/* Accessible Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p style={{ fontWeight: 700, color: '#0f172a' }}>
            Sahaay AI — From everyday problems to real-world action.
          </p>
          <p>
            Powered by Google Gemini 2.5 multimodal intelligence & authoritative Indian municipal frameworks (Solid Waste Management Rules 2016).
          </p>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Designed for civic benefit. Sahaay AI does not replace statutory municipal inspectors or fabricate complaint reference numbers.
          </p>
        </div>
      </footer>
    </div>
  );
};
