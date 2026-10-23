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
- **Interactive OpenStreetMap Leaflet Map:** 
  - Instant area/locality search across Indian metros (Delhi NCR, Mumbai, Bengaluru, Chennai, Hyderabad, Pune, Kolkata).
  - Quick Metro Jump chips for 1-click navigation.
  - Drag or click to pinpoint exact dumps with reverse-geocoding into real street names, neighborhoods, wards, and PIN codes.

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
  - Object detection bounding boxes highlighting waste clusters

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
  - **KMC (Kolkata)** — Kolkata Municipal Corporation (033-2286-1212)
- PIN Code to Ward Directory mapping 25+ major Indian PIN codes to exact administrative wards, junior health inspectors, and SWM maintenance depots.

### D. Actionable Resolution & Citizen Advocacy
- **6 Indic Language Complaint Drafts:** Automatically generates formal municipal grievance letters in English, Hindi (हिंदी), Kannada (ಕನ್ನಡ), Tamil (தமிழ்), Telugu (తెలుగు), and Marathi (मराठी).
- **Text-to-Speech:** Listen to complaint drafts read aloud in Indic languages.
- **Official Direct Actions:** 1-click links to official grievance portals (BBMP Sahaaya, MCD 311, MyBMC, Swachhata-MoHUA), official WhatsApp helplines, and Twitter/X tagging.
- **Citizen Endorsements & Printables:** +1 co-signatures for community escalation, printable A4 PDF complaint petitions, and QR placards for physical posting at black-spots.
- **Before / After Resolution Verification:** Upload post-clearance photograph proof with date stamps to verify municipal turnaround.

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, TypeScript, Lucide Icons, Leaflet.js
- **Backend:** Node.js, Express.js REST API, Multer (in-memory image & audio processing)
- **AI / LLM:** Google Gen AI SDK (`@google/genai`), Gemini 2.5 Flash
- **Persistence:** Atomic JSON Document Store with zero external database dependencies
- **Styling:** Custom accessible design system adhering to Indian municipal visual identity

---

## 4. Getting Started Locally

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

### Running Locally
```bash
# Install root dependencies
npm install

# Start both backend and frontend concurrently
npm run dev
```
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **API Health:** http://localhost:3001/api/health

### Running Automated Tests
```bash
npm test
```

---

## 5. 🚀 One-Click Cloud Deployment

Sahaay AI is production-ready and configured to deploy as a unified full-stack service (Express serves both the API and the React frontend on a single port).

### Deploy to Render (Recommended - Free Tier)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your repository: `https://github.com/awsoumya/SahaayAI`.
4. Configure the settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server/src/index.js`
5. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = *(Optional: your Google AI Studio key)*
   - `GEMINI_MODEL` = `gemini-2.5-flash`
6. Click **Create Web Service**. Your app will be live at `https://<your-service>.onrender.com`!

### Deploy to Railway
1. Go to [Railway.app](https://railway.app).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select `awsoumya/SahaayAI`.
4. Railway will automatically detect the `Procfile` and deploy your app.

### Deploy to Vercel
1. Go to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project** and import `awsoumya/SahaayAI`.
3. Vercel automatically uses the included [`vercel.json`](./vercel.json).
4. Click **Deploy**.

---

*Developed with Google Gemini for civic empowerment in Indian cities.*
