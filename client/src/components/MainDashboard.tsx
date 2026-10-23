import React, { useState, useRef, useEffect } from 'react';
import exifr from 'exifr';
import {
  FileText,
  Camera,
  Mic,
  MapPin,
  Sparkles,
  AlertCircle,
  X,
  UploadCloud,
  CheckCircle2,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Trash2,
  Music,
  Map,
  Compass
} from 'lucide-react';
import { LocationData } from '../types';
import { MapPicker } from './MapPicker';
import { reverseGeocode } from '../services/api';

interface MainDashboardProps {
  onAnalyze: (payload: {
    text: string;
    imageFile: File | null;
    audioFile: File | null;
    location: LocationData;
    inputType: 'text' | 'voice' | 'image';
  }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  onAnalyze,
  isLoading,
  error,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'photo' | 'voice'>('text');
  const [textInput, setTextInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [exifNotice, setExifNotice] = useState<string | null>(null);

  // Audio file upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Location state
  const [location, setLocation] = useState<LocationData>({
    city: '',
    neighborhood: '',
    landmark: '',
    address: '',
    source: 'not_provided',
    user_confirmation_required: true,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('sahaay_issue_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.text) setTextInput(parsed.text);
        if (parsed.location) setLocation(parsed.location);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Autosave draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'sahaay_issue_draft',
        JSON.stringify({ text: textInput, location })
      );
    } catch {
      // Ignore storage errors
    }
  }, [textInput, location]);

  // Setup Web Speech Recognition if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Preset Realistic Scenarios
  const handleSelectScenario = (index: number) => {
    switch (index) {
      case 1:
        setTextInput(
          'There is an overflowing garbage bin near our apartment. Waste has been lying there for four days, and stray animals are scattering it across the pavement.'
        );
        setLocation({
          city: 'Bengaluru',
          neighborhood: 'Indiranagar',
          landmark: '12th Main Road, near Indiranagar Club',
          address: 'HAL 2nd Stage, Indiranagar',
          latitude: 12.9719,
          longitude: 77.6412,
          source: 'user_provided',
          user_confirmation_required: false,
        });
        setActiveTab('text');
        break;
      case 2:
        setTextInput(
          'Garbage has not been collected by the municipal tippers for five days in our lane. Wet waste is decomposing and creating foul stench.'
        );
        setLocation({
          city: 'Mumbai',
          neighborhood: 'Andheri West',
          landmark: 'Lokhandwala Market lane 4',
          address: 'Near Highland Park, Lokhandwala',
          latitude: 19.1416,
          longitude: 72.8256,
          source: 'user_provided',
          user_confirmation_required: false,
        });
        setActiveTab('text');
        break;
      case 3:
        setTextInput(
          'Someone keeps dumping construction waste beside the public road near our school. Heavy concrete debris and sandbags are blocking vehicular and pedestrian passage.'
        );
        setLocation({
          city: 'New Delhi',
          neighborhood: 'Dwarka Sector 12',
          landmark: 'Opposite Government Boys Senior Secondary School',
          address: 'Sector 12 Main Road, Dwarka',
          latitude: 28.5921,
          longitude: 77.0460,
          source: 'user_provided',
          user_confirmation_required: false,
        });
        setActiveTab('text');
        break;
      case 4:
        setTextInput(
          'Plastic waste and shopping bags are blocking the stormwater drain outside our building. After rain, water accumulates near the entrance creating a mosquito breeding hazard.'
        );
        setLocation({
          city: 'Chennai',
          neighborhood: 'Adyar',
          landmark: 'Gandhi Nagar 2nd Main Road',
          address: 'Near Adyar Bridge junction',
          latitude: 13.0012,
          longitude: 80.2565,
          source: 'user_provided',
          user_confirmation_required: false,
        });
        setActiveTab('text');
        break;
      case 5:
        setTextInput(
          'A huge heap of commercial organic waste and discarded packaging has accumulated within 50 meters of the district hospital entrance.'
        );
        setLocation({
          city: 'Hyderabad',
          neighborhood: 'Secunderabad',
          landmark: 'Near Gandhi Hospital emergency gate',
          address: 'Musheerabad, Secunderabad',
          latitude: 17.4239,
          longitude: 78.5044,
          source: 'user_provided',
          user_confirmation_required: false,
        });
        setActiveTab('text');
        break;
      default:
        break;
    }
  };

  // Image upload handling with EXIF GPS extraction
  const handleImageFile = async (file: File) => {
    setImageError(null);
    setExifNotice(null);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!validMimes.includes(file.type)) {
      setImageError('Please select a valid image (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setImageError('Image file size exceeds the 8 MB maximum limit.');
      return;
    }

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Attempt client-side EXIF GPS extraction
    try {
      const parsedExif = await exifr.parse(file, ['latitude', 'longitude', 'DateTimeOriginal']);
      if (parsedExif && parsedExif.latitude && parsedExif.longitude) {
        const lat = parsedExif.latitude;
        const lon = parsedExif.longitude;

        setExifNotice(`Extracted GPS from photo EXIF: (${lat.toFixed(4)}, ${lon.toFixed(4)}). Resolving municipal address...`);

        try {
          const geo = await reverseGeocode(lat, lon);
          setLocation((prev) => ({
            ...prev,
            ...geo,
            latitude: lat,
            longitude: lon,
            source: 'photo_exif',
            user_confirmation_required: false,
          }));
          setExifNotice(`📍 Auto-filled from Photo EXIF: ${geo.neighborhood || geo.landmark}, ${geo.city}`);
        } catch {
          setLocation((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lon,
            source: 'photo_exif',
          }));
        }
      }
    } catch {
      // EXIF parsing not present in this photo, silent fallback
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setExifNotice(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  // Audio file selection handling
  const handleAudioFile = (file: File) => {
    setAudioFile(file);
    setActiveTab('voice');
  };

  // Voice recording handling
  const handleToggleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    } else {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSpeechSupported(false);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English

        recognition.onstart = () => {
          setIsRecording(true);
          setRecordingDuration(0);
          timerRef.current = setInterval(() => {
            setRecordingDuration((prev) => prev + 1);
          }, 1000);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setVoiceTranscript(currentTranscript.trim());
          setTextInput(currentTranscript.trim());
        };

        recognition.onerror = () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };

        recognition.onend = () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to start microphone speech recognition:', err);
        setSpeechSupported(false);
      }
    }
  };

  // Browser Geolocation with automatic reverse geocoding
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationNotice('Detecting coordinates & resolving street address...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;

        try {
          const geo = await reverseGeocode(latitude, longitude);
          setLocation((prev) => ({
            ...prev,
            ...geo,
            latitude,
            longitude,
            source: 'browser_gps',
            user_confirmation_required: false,
          }));
          setLocationNotice(`📍 Location detected: ${geo.neighborhood || geo.landmark}, ${geo.city}`);
        } catch {
          setLocation((prev) => ({
            ...prev,
            latitude,
            longitude,
            source: 'browser_gps',
            address: `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            user_confirmation_required: true,
          }));
          setLocationNotice(`Detected coordinates (${latitude.toFixed(3)}, ${longitude.toFixed(3)}). Please confirm city.`);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        setLocationNotice('Location access was denied or timed out. You can manually enter your city or use the map below.');
      },
      { timeout: 8000 }
    );
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalContent = activeTab === 'voice' && voiceTranscript ? voiceTranscript : textInput;

    if (!finalContent.trim() && !imageFile && !audioFile) {
      alert('Please provide a description, speak into the microphone, or upload a photo/audio note.');
      return;
    }

    await onAnalyze({
      text: finalContent,
      imageFile,
      audioFile,
      location,
      inputType: activeTab === 'photo' ? 'image' : activeTab,
    });
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <h2 className="page-title">Report a sanitation issue</h2>
        <p className="page-subtitle">
          From uncollected garbage to blocked drains — convert messy real-world descriptions, voice notes, and photos into verified civic complaints and actionable resolutions for Indian municipal bodies.
        </p>
      </div>

      {/* Preset Hackathon Demonstration Scenarios */}
      <div className="scenarios-section">
        <div className="scenarios-label">
          <Sparkles size={14} />
          <span>Quick Hackathon Test Scenarios (Click to populate)</span>
        </div>
        <div className="scenario-buttons">
          <button type="button" className="scenario-btn" onClick={() => handleSelectScenario(1)}>
            <Trash2 size={14} />
            <span>1. Overflowing Waste Bin (4 days)</span>
          </button>
          <button type="button" className="scenario-btn" onClick={() => handleSelectScenario(2)}>
            <AlertCircle size={14} />
            <span>2. Garbage Not Collected</span>
          </button>
          <button type="button" className="scenario-btn" onClick={() => handleSelectScenario(3)}>
            <ShieldAlert size={14} />
            <span>3. Illegal Construction Dumping</span>
          </button>
          <button type="button" className="scenario-btn" onClick={() => handleSelectScenario(4)}>
            <Navigation size={14} />
            <span>4. Blocked Drainage Choked with Plastic</span>
          </button>
          <button type="button" className="scenario-btn" onClick={() => handleSelectScenario(5)}>
            <MapPin size={14} />
            <span>5. Waste Near Hospital Entrance</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="demo-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <div className="demo-banner-content">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Input Form Card */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Tabs: Text | Photo | Voice */}
          <div className="input-tabs">
            <button
              type="button"
              className={`input-tab ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              <FileText size={16} />
              <span>Text Description</span>
            </button>
            <button
              type="button"
              className={`input-tab ${activeTab === 'photo' ? 'active' : ''}`}
              onClick={() => setActiveTab('photo')}
            >
              <Camera size={16} />
              <span>Evidence Photograph {imageFile ? '(1 attached)' : ''}</span>
            </button>
            <button
              type="button"
              className={`input-tab ${activeTab === 'voice' ? 'active' : ''}`}
              onClick={() => setActiveTab('voice')}
            >
              <Mic size={16} />
              <span>Voice Note {isRecording ? '● Live' : audioFile ? '(1 audio attached)' : ''}</span>
            </button>
          </div>

          {/* Tab 1: Text Input */}
          {activeTab === 'text' && (
            <div className="form-group">
              <textarea
                className="textarea-field"
                placeholder="Describe what happened. For example, garbage has been lying outside our apartment for four days, the bin is overflowing, and stray animals are scattering the waste. I don't know where to report it."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={5}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                <span>Be as specific as possible regarding duration and immediate hazards.</span>
                <span>{textInput.length} characters</span>
              </div>
            </div>
          )}

          {/* Tab 2: Photo Input (Screen B) */}
          {activeTab === 'photo' && (
            <div className="form-group">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                  }
                }}
              />

              {!imagePreview ? (
                <div
                  className="dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="dropzone-icon" />
                  <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                    Click or drag & drop a photograph of the sanitation issue
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Supports JPEG, PNG, WebP (up to 8 MB). Automatically extracts GPS coordinates and capture timestamps from EXIF metadata.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="image-preview-wrapper">
                    <img src={imagePreview} alt="Uploaded evidence" className="image-preview" />
                    <button
                      type="button"
                      className="image-remove-btn"
                      onClick={handleRemoveImage}
                      title="Remove image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                    >
                      Replace Photograph
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRemoveImage}
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem', color: '#dc2626' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {exifNotice && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.82rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={14} />
                  <span>{exifNotice}</span>
                </div>
              )}

              {imageError && (
                <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  {imageError}
                </p>
              )}

              <div style={{ marginTop: '1rem' }}>
                <label className="form-label">Additional notes for this photo (optional)</label>
                <input
                  type="text"
                  className="text-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. This photo was taken this morning near the building gate."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Tab 3: Voice Input & Audio Upload (Screen C) */}
          {activeTab === 'voice' && (
            <div className="voice-recorder-card">
              <input
                type="file"
                ref={audioInputRef}
                style={{ display: 'none' }}
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleAudioFile(e.target.files[0]);
                  }
                }}
              />

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className={`mic-button ${isRecording ? 'recording' : ''}`}
                  onClick={handleToggleVoice}
                  title={isRecording ? 'Stop recording' : 'Click to start voice recording'}
                >
                  <Mic size={28} />
                </button>

                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 700, fontSize: '1rem' }}>
                    {isRecording ? `Recording in progress (${formatTimer(recordingDuration)})` : 'Live Voice Recording'}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Speak in Hindi or Indian English. Transcribed live and analyzed by Gemini.
                  </p>
                </div>
              </div>

              {/* Or upload audio file */}
              <div style={{ borderTop: '1px solid #e2e8f0', width: '100%', paddingTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Music size={15} color="#2563eb" />
                  <span>Have an existing voice memo?</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {audioFile && (
                    <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {audioFile.name} ({(audioFile.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => audioInputRef.current?.click()}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    {audioFile ? 'Replace Audio Note' : 'Upload Audio File (.mp3, .wav, .m4a)'}
                  </button>
                  {audioFile && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAudioFile(null)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', color: '#dc2626' }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {!speechSupported && (
                <div style={{ background: '#fef3c7', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.82rem', color: '#92400e' }}>
                  Live speech recognition is not supported in this browser. You can upload an audio note or type below.
                </div>
              )}

              {/* Editable transcript box */}
              <div style={{ width: '100%', textAlign: 'left', marginTop: '0.5rem' }}>
                <label className="form-label">Review & Edit Voice Transcript:</label>
                <textarea
                  className="textarea-field"
                  style={{ minHeight: '90px' }}
                  placeholder="Transcript will appear here as you speak. You can review and edit before submitting."
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    setVoiceTranscript(e.target.value);
                  }}
                />
              </div>
            </div>
          )}

          {/* Location Controls & Interactive Map (Screen A & Section 7) */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={15} color="#2563eb" />
                <span>Problem Location (Used to identify your municipal corporation)</span>
              </span>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn ${showMap ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowMap(!showMap)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  <Map size={13} />
                  <span>{showMap ? 'Hide Map' : '🗺️ Pinpoint on Map'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleUseMyLocation}
                  disabled={isLocating}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                >
                  {isLocating ? <Loader2 size={13} className="spinner spinner-primary" /> : <Navigation size={13} />}
                  <span>{isLocating ? 'Detecting...' : 'Use my GPS'}</span>
                </button>
              </div>
            </div>

            {locationNotice && (
              <p style={{ fontSize: '0.82rem', color: '#2563eb', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span>{locationNotice}</span>
              </p>
            )}

            {/* Embedded Interactive Leaflet Map */}
            {showMap && (
              <div style={{ marginBottom: '1.25rem' }}>
                <MapPicker
                  initialLat={location.latitude}
                  initialLon={location.longitude}
                  onLocationSelect={(selectedLoc) => {
                    setLocation((prev) => ({
                      ...prev,
                      ...selectedLoc,
                    }));
                  }}
                />
              </div>
            )}

            <div className="location-row">
              <div className="form-group">
                <label className="form-label">Postal PIN Code (Auto-routes to Ward)</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. 560038, 110075, 400053"
                  maxLength={6}
                  value={location.postcode || ''}
                  onChange={(e) =>
                    setLocation((prev) => ({
                      ...prev,
                      postcode: e.target.value,
                      source: 'user_provided',
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">City / Corporation</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Bengaluru, Delhi, Mumbai"
                  value={location.city || ''}
                  onChange={(e) =>
                    setLocation((prev) => ({
                      ...prev,
                      city: e.target.value,
                      source: 'user_provided',
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Neighborhood / Area</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Indiranagar, Dwarka, Andheri"
                  value={location.neighborhood || ''}
                  onChange={(e) =>
                    setLocation((prev) => ({
                      ...prev,
                      neighborhood: e.target.value,
                      source: 'user_provided',
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Landmark / Nearest Street</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Near Indiranagar Club / Main Rd"
                  value={location.landmark || ''}
                  onChange={(e) =>
                    setLocation((prev) => ({
                      ...prev,
                      landmark: e.target.value,
                      source: 'user_provided',
                    }))
                  }
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  style={{ width: '100%', height: '40px' }}
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" />
                      <span>Analyzing with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Analyze Problem</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
            <ShieldCheck size={14} color="#16a34a" />
            <span>
              <strong>Privacy Guarantee:</strong> Sahaay AI processes data strictly for civic problem analysis. Uploaded photos are never retained permanently or shared without your permission.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
