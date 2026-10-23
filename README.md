# Sahaay AI (सहाय AI)

> *“From everyday problems to real-world action.”*

A modern, Gemini-powered civic sanitation intelligence web application engineered specifically for Indian cities. Sahaay AI acts as a universal bridge between messy, real-world human intent—voice notes, photographs with EXIF GPS, audio files, and unstructured text—and structured, verified, actionable outcomes with Indian municipal authorities.

---

## 1. Problem Statement

Garbage accumulation, overflowing waste bins, illegal dumping of construction debris, and choked stormwater drains represent persistent public health and civic challenges in Indian urban centers. Residents frequently encounter uncollected waste or unhygienic public spaces, but face steep friction:
- Unclear municipal jurisdictions (Which authority is responsible?)
- Disjointed grievance portals (BBMP Sahaaya, MCD 311, MyBMC, Swachhata-MoHUA)
- Lack of knowledge on what evidence or statutory framing is required
- Inability to verify claims against citizen charters and the **Solid Waste Management (SWM) Rules 2016**

**Sahaay AI** eliminates this gap by taking unstructured inputs and producing structured, fact-checked, actionable complaints ready for official submission.

---

## 2. Core Features & Capabilities

### A. Multimodal Input Capture
- **Text Input:** Fast, responsive text area with 5 one-click realistic test scenarios and auto-save draft persistence in `localStorage`.
- **Evidence Photographs with EXIF GPS Extraction:** Drag & drop image upload supporting JPEG, PNG, and WebP (up to 8 MB). Automatically parses EXIF metadata to auto-extract GPS coordinates and capture timestamps directly from phone camera photos.
- **Voice & Audio Notes:** 
  - Live Indian English / Hindi speech recognition with duration counter and live editable transcript.
  - Native audio file uploader (`.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`) passed directly to Gemini's audio model.
- **Interactive OpenStreetMap Leaflet Map:** Click or drag anywhere on the map to pinpoint the exact dump location, with automated reverse-geocoding into real street names, neighborhoods, cities, and postal codes.

### B. Structured Gemini Multimodal Intelligence
- Integrates the official Google Gen AI SDK: `@google/genai`.
- System instruction tailored for Indian civic sanitation frameworks.
- Configurable model via `GEMINI_MODEL` (defaults to `gemini-2.5-flash`).
- Strictly structured JSON Schema enforcement:
  - `issue_title`, `category`, `problem_summary`
  - 4-Box Evidence Grid: **Citizen Facts**, **Visible Image Observations**, **AI Inferences**, **Uncertainties & Limitations**
  - Transparent Urgency Rating: `routine`, `needs_prompt_attention`, `potentially_urgent` with explicit limitations
  - Numbered, rationalized Action Plan
  - Inline Missing Information prompt

### C. Independent Source Verification Engine
- **Decoupled from model claims:** Does not blindly trust AI-generated assertions.
- Maps locations against a gazetted municipal directory covering:
  - **Ministry of Housing and Urban Affairs (MoHUA)** — Pan-India Swachh Bharat Urban (1969)
  - **BBMP (Bengaluru)** — Bruhat Bengaluru Mahanagara Palike (1533)
  - **MCD (Delhi)** — Municipal Corporation of Delhi (155305)
  - **BMC (Mumbai)** — Brihanmumbai Municipal Corporation (1916)
  - **GCC (Chennai)** — Greater Chennai Corporation (1913)
  - **GHMC (Hyderabad)** — Greater Hyderabad Municipal Corporation (040-21111111)
  - **PMC (Pune)** — Pune Municipal Corporation (1800 1030 222)
  - **KMC (Kolkata)** — Kolkata Municipal Corporation (155357)
- Displays verified sources, retrieval timestamps, what the source actually confirms, and citizen charter turnaround SLAs (24-48 hours).
- Honestly flags unverified claims with: *“Verification pending — we could not confirm this information from an available authoritative source.”*

### D. Bilingual Statutory Complaint Generator & Citizen Mobilization
- **Bilingual Drafts:** Generates both an English formal letter and a formal **हिन्दी (Hindi) शिकायत पत्र** adhering to standard Indian governmental petition formatting ("सेवा में, श्रीमान सहायक आयुक्त / मुख्य सफाई निरीक्षक...").
- **WhatsApp Community Mobilization:** One-click **Share on WhatsApp** button to broadcast structured alerts to local Resident Welfare Association (RWA) and ward groups.
- **Formal Printable Petition:** Browser print styling for physical submission at zonal municipal offices.
- One-click **Copy to Clipboard** and **Download as .txt**.
- Direct link to open the verified official municipal portal or mobile app.
- **Honest Submissions:** Never fabricates fake confirmation numbers. Explains why citizen mobile/OTP authentication is required by government portals and delivers a pre-formatted draft.

### E. Civic Resolution Lifecycle & Accountability (My Reports)
- Full local database persistence with atomic writes.
- **Dynamic SLA Countdown Timer:** Live tracking against the 24-hr/48-hr statutory Citizen Charter guarantee with alerts when breached.
- **Before & After Resolution Verification:** Allows citizens to attach a photographic proof of clearance and inspection notes when marking reports as `resolved`.
- Search and filter by category, city, or status (`draft`, `needs_more_info`, `verification_pending`, `ready_to_submit`, `submitted`, `resolved`).

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, TypeScript, Leaflet, Exifr, Lucide React icons, Custom Accessible Design System.
- **Backend:** Node.js, Express.js, Multer (media handling), CORS, Dotenv.
- **AI SDK:** Official `@google/genai` (Google Gen AI JavaScript SDK).
- **Persistence:** High-durability file-backed atomic JSON store (SQLite-compatible data model).
- **Testing:** Node.js native test runner (`node --test`).

---

## 4. Getting Started

### Prerequisites
- Node.js (v18 or higher; v24 recommended)
- npm (v9 or higher)

### Environment Configuration
Configure your environment variables in `server/.env`:
```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_google_ai_studio_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

> **Note on Demonstration Mode:** If `GEMINI_API_KEY` is omitted, Sahaay AI automatically operates in **High-Fidelity Demonstration Mode**. All 5 hackathon scenarios, validation schemas, verification logic, and UI workflows function out of the box with zero external dependencies!

---

## 5. Running the Application

### Development Mode (Both Frontend & Backend)
From the project root:
```bash
npm run dev
```
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **API Health:** http://localhost:3001/api/health

### Production Build & Preview
```bash
# Build the React Vite client
npm run build

# Start production server & preview
npm start
```

### Running Automated Tests
Run the automated test suite covering verification logic, schema compliance, and database operations:
```bash
npm test
```

---

*Developed with Google Gemini for civic empowerment in Indian cities.*
