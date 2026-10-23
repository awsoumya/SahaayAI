import React from 'react';
import { ShieldCheck, FileText, Info, Sparkles, Map } from 'lucide-react';
import { BackendHealth } from '../types';

interface HeaderProps {
  currentTab: 'report' | 'hotspots' | 'my-reports' | 'how-it-works';
  onSelectTab: (tab: 'report' | 'hotspots' | 'my-reports' | 'how-it-works') => void;
  reportCount: number;
  health: BackendHealth | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  reportCount,
  health,
}) => {
  const isLive = health?.gemini?.configured;

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="brand-wrapper" onClick={() => onSelectTab('report')}>
          <div className="brand-icon">
            <ShieldCheck size={26} strokeWidth={2.4} />
          </div>
          <div className="brand-text">
            <h1>Sahaay AI</h1>
            <span>From everyday problems to real-world action</span>
          </div>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-item ${currentTab === 'report' ? 'active' : ''}`}
            onClick={() => onSelectTab('report')}
          >
            <Sparkles size={16} />
            <span>Report Issue</span>
          </button>

          <button
            className={`nav-item ${currentTab === 'hotspots' ? 'active' : ''}`}
            onClick={() => onSelectTab('hotspots')}
          >
            <Map size={16} />
            <span>Hotspots Map</span>
          </button>

          <button
            className={`nav-item ${currentTab === 'my-reports' ? 'active' : ''}`}
            onClick={() => onSelectTab('my-reports')}
          >
            <FileText size={16} />
            <span>My Reports</span>
            {reportCount > 0 && <span className="nav-badge">{reportCount}</span>}
          </button>

          <button
            className={`nav-item ${currentTab === 'how-it-works' ? 'active' : ''}`}
            onClick={() => onSelectTab('how-it-works')}
          >
            <Info size={16} />
            <span>How It Works & Trust</span>
          </button>

          <div
            className="api-status-pill"
            title={
              isLive
                ? `Active Gemini Model: ${health?.gemini?.model}`
                : 'Running in High-Fidelity Demonstration Mode. Set GEMINI_API_KEY in server/.env for live AI calls.'
            }
          >
            <span className={`api-status-dot ${isLive ? 'live' : 'demo'}`}></span>
            <span>{isLive ? `Gemini Live (${health?.gemini?.model})` : 'Demo Mode'}</span>
          </div>
        </nav>
      </div>
    </header>
  );
};
