import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Detailed System Instruction for Sahaay AI Civic Sanitation Assistant
const SYSTEM_INSTRUCTION = `
You are Sahaay AI, an expert civic sanitation intelligence system for Indian cities.
Your mission is to bridge the gap between ordinary residents and complex municipal systems (e.g., Swachh Bharat Urban, BBMP Bengaluru, MCD Delhi, BMC Mumbai, GCC Chennai, etc.).

Analyze the user's input (unstructured text, photographic evidence, audio recordings, and location metadata).
Adhere strictly to the following core tenets:
1. OBJECTIVE & HONEST: Separate visible facts from citizen claims and separate inferences from uncertainties.
2. DETECT BOUNDING BOXES: When an image is provided, identify bounding box coordinates normalized to 0-1000 scale: [ymin, xmin, ymax, xmax] for visible waste objects (e.g. overflowing bin, plastic litter, construction debris, choked drain).
3. STATUTORY WASTE SEGREGATION: Under Solid Waste Management Rules 2016, estimate waste breakdown percentages:
   - dry_recyclable_pct (Plastic, paper, cardboard, metal, glass)
   - wet_biodegradable_pct (Food, organic scraps, vegetable market refuse)
   - construction_demolition_pct (C&D rubble, concrete, bricks, silt)
   - hazardous_sanitary_pct (Sanitary, medical, chemical, batteries)
4. TRANSPARENT URGENCY: Use levels "routine", "needs_prompt_attention", "potentially_urgent".
5. MULTI-REGIONAL INDIC COMPLAINTS: Provide formal complaint drafts in:
   - English (en)
   - Hindi (hi)
   - Kannada (kn)
   - Tamil (ta)
   - Telugu (te)
   - Marathi (mr)
6. STRUCTURED JSON: You MUST respond ONLY with a valid JSON object matching the requested schema.
`;

export const SANITATION_SCHEMA = {
  type: 'object',
  properties: {
    issue_title: { type: 'string', description: 'Concise 4-8 word title of the sanitation issue' },
    category: {
      type: 'string',
      enum: ['overflowing_bin', 'uncollected_garbage', 'illegal_dumping', 'blocked_drainage', 'waste_near_sensitive_zone', 'littering_public_space', 'general_sanitation']
    },
    problem_summary: { type: 'string', description: '2-3 sentence plain-language summary' },
    input_types: {
      type: 'array',
      items: { type: 'string' }
    },
    location: {
      type: 'object',
      properties: {
        city: { type: ['string', 'null'] },
        neighborhood: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] },
        landmark: { type: ['string', 'null'] },
        source: { type: 'string' },
        user_confirmation_required: { type: 'boolean' }
      },
      required: ['source', 'user_confirmation_required']
    },
    observation: {
      type: 'object',
      properties: {
        user_reported_facts: { type: 'array', items: { type: 'string' } },
        visible_image_observations: { type: 'array', items: { type: 'string' } },
        ai_inferences: { type: 'array', items: { type: 'string' } },
        uncertainties: { type: 'array', items: { type: 'string' } }
      },
      required: ['user_reported_facts', 'visible_image_observations', 'ai_inferences', 'uncertainties']
    },
    bounding_boxes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          box_2d: { type: 'array', items: { type: 'integer' } }, // [ymin, xmin, ymax, xmax] 0-1000
          label: { type: 'string' },
          confidence: { type: 'number' },
          category: { type: 'string' }
        },
        required: ['box_2d', 'label', 'confidence']
      }
    },
    waste_segregation_breakdown: {
      type: 'object',
      properties: {
        dry_recyclable_pct: { type: 'integer' },
        wet_biodegradable_pct: { type: 'integer' },
        construction_demolition_pct: { type: 'integer' },
        hazardous_sanitary_pct: { type: 'integer' },
        segregation_recommendations: { type: 'array', items: { type: 'string' } }
      },
      required: ['dry_recyclable_pct', 'wet_biodegradable_pct', 'construction_demolition_pct', 'hazardous_sanitary_pct', 'segregation_recommendations']
    },
    urgency: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          enum: ['routine', 'needs_prompt_attention', 'potentially_urgent']
        },
        reasons: { type: 'array', items: { type: 'string' } },
        limitations: { type: 'array', items: { type: 'string' } }
      },
      required: ['level', 'reasons', 'limitations']
    },
    missing_information: {
      type: 'array',
      items: { type: 'string' }
    },
    recommended_actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          step: { type: 'integer' },
          action: { type: 'string' },
          purpose: { type: 'string' }
        },
        required: ['step', 'action', 'purpose']
      }
    },
    verification_requirements: {
      type: 'array',
      items: { type: 'string' }
    },
    complaint_drafts: {
      type: 'object',
      properties: {
        en: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
          required: ['subject', 'body']
        },
        hi: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
          required: ['subject', 'body']
        },
        kn: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
          required: ['subject', 'body']
        },
        ta: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
          required: ['subject', 'body']
        },
        te: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
          required: ['subject', 'body']
        },
        mr: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
          required: ['subject', 'body']
        }
      },
      required: ['en', 'hi', 'kn', 'ta', 'te', 'mr']
    }
  },
  required: [
    'issue_title',
    'category',
    'problem_summary',
    'input_types',
    'location',
    'observation',
    'waste_segregation_breakdown',
    'urgency',
    'missing_information',
    'recommended_actions',
    'verification_requirements',
    'complaint_drafts'
  ]
};

export async function analyzeSanitationIssue({ text = '', image = null, audio = null, location = {}, inputType = 'text' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const inputTypes = [];
  if (text && text.trim().length > 0) inputTypes.push(inputType === 'voice' ? 'voice' : 'text');
  if (image && image.data) inputTypes.push('image');
  if (audio && audio.data) inputTypes.push('audio');
  if (inputTypes.length === 0) inputTypes.push('text');

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = [];

      let promptText = `User Description of Sanitation Issue: "${text || 'No text provided. Please inspect attached media carefully.'}"\n`;
      if (location && (location.city || location.neighborhood || location.landmark || location.address || location.postcode)) {
        promptText += `User Provided Location Context: ${JSON.stringify(location)}\n`;
      }
      promptText += `\nPlease evaluate according to the Sahaay AI framework, detect bounding boxes [ymin, xmin, ymax, xmax] for any visible waste, estimate waste segregation percentages, and generate multi-regional Indic complaint drafts.`;

      contents.push({ text: promptText });

      if (image && image.data) {
        contents.push({
          inlineData: {
            mimeType: image.mimeType || 'image/jpeg',
            data: image.data
          }
        });
      }

      if (audio && audio.data) {
        contents.push({
          inlineData: {
            mimeType: audio.mimeType || 'audio/mp3',
            data: audio.data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: SANITATION_SCHEMA,
          temperature: 0.2
        }
      });

      const parsed = JSON.parse(response.text);
      const validated = validateAndNormalize(parsed, location, inputTypes);
      validated._meta = {
        is_live_gemini: true,
        model: modelName,
        analyzed_at: new Date().toISOString()
      };
      return validated;
    } catch (err) {
      console.error('Error invoking Google Gen AI SDK (@google/genai):', err.message);
      return generateFallbackAnalysis({ text, image, audio, location, inputTypes, errMessage: err.message });
    }
  }

  return generateFallbackAnalysis({
    text,
    image,
    audio,
    location,
    inputTypes,
    errMessage: 'GEMINI_API_KEY is not configured in server/.env. Running in Sahaay AI Demo Mode.'
  });
}

function validateAndNormalize(data, locationContext = {}, inputTypes = ['text']) {
  const norm = { ...data };

  norm.input_types = inputTypes;
  norm.category = norm.category || 'general_sanitation';
  norm.issue_title = norm.issue_title || 'Sanitation Concern Report';
  norm.problem_summary = norm.problem_summary || 'Sanitation issue identified by citizen report.';

  norm.location = {
    city: norm.location?.city || locationContext.city || null,
    neighborhood: norm.location?.neighborhood || locationContext.neighborhood || null,
    address: norm.location?.address || locationContext.address || null,
    landmark: norm.location?.landmark || locationContext.landmark || null,
    postcode: norm.location?.postcode || locationContext.postcode || null,
    source: norm.location?.source || (locationContext.city ? 'user_provided' : 'not_provided'),
    user_confirmation_required: norm.location?.user_confirmation_required ?? true
  };

  norm.observation = {
    user_reported_facts: Array.isArray(norm.observation?.user_reported_facts) ? norm.observation.user_reported_facts : [],
    visible_image_observations: Array.isArray(norm.observation?.visible_image_observations) ? norm.observation.visible_image_observations : [],
    ai_inferences: Array.isArray(norm.observation?.ai_inferences) ? norm.observation.ai_inferences : [],
    uncertainties: Array.isArray(norm.observation?.uncertainties) ? norm.observation.uncertainties : []
  };

  norm.bounding_boxes = Array.isArray(norm.bounding_boxes) ? norm.bounding_boxes : [];

  norm.waste_segregation_breakdown = norm.waste_segregation_breakdown || {
    dry_recyclable_pct: 45,
    wet_biodegradable_pct: 40,
    construction_demolition_pct: 10,
    hazardous_sanitary_pct: 5,
    segregation_recommendations: ['Deploy separate wet/dry tipper partitions during clearance.']
  };

  norm.urgency = {
    level: ['routine', 'needs_prompt_attention', 'potentially_urgent'].includes(norm.urgency?.level)
      ? norm.urgency.level
      : 'needs_prompt_attention',
    reasons: Array.isArray(norm.urgency?.reasons) ? norm.urgency.reasons : ['Awaiting on-ground verification by municipal ward office.'],
    limitations: Array.isArray(norm.urgency?.limitations) ? norm.urgency.limitations : ['Urgency assessment based strictly on citizen report and photographic sample.']
  };

  norm.missing_information = Array.isArray(norm.missing_information) ? norm.missing_information : [];
  norm.recommended_actions = Array.isArray(norm.recommended_actions) ? norm.recommended_actions : [];
  norm.verification_requirements = Array.isArray(norm.verification_requirements) ? norm.verification_requirements : [];

  if (norm.complaint_drafts?.en) {
    norm.complaint_draft = {
      subject: norm.complaint_drafts.en.subject,
      body: norm.complaint_drafts.en.body,
      subject_hindi: norm.complaint_drafts.hi?.subject,
      body_hindi: norm.complaint_drafts.hi?.body,
    };
  }

  return norm;
}

function generateFallbackAnalysis({ text = '', image = null, audio = null, location = {}, inputTypes = ['text'], errMessage = '' }) {
  const lower = text.toLowerCase();
  const city = location.city || null;
  const neighborhood = location.neighborhood || null;
  const landmark = location.landmark || null;
  const locationStr = [landmark, neighborhood, city].filter(Boolean).join(', ') || 'Reported Location';

  let category = 'general_sanitation';
  let issueTitle = 'Civic Sanitation Issue';
  let problemSummary = 'Accumulation of uncollected waste reported by local resident.';
  let urgencyLevel = 'needs_prompt_attention';
  const userFacts = [];
  const imageObservations = [];
  const aiInferences = [];
  const uncertainties = [];
  const missingInfo = [];
  const recommendedActions = [];
  const verificationReqs = [];
  const boundingBoxes = [];

  let dryPct = 40;
  let wetPct = 45;
  let cdPct = 10;
  let hazPct = 5;

  if (lower.includes('overflowing') || lower.includes('bin') || lower.includes('dustbin') || lower.includes('four days') || lower.includes('animals')) {
    category = 'overflowing_bin';
    issueTitle = 'Overflowing Public Garbage Bin & Waste Spillage';
    problemSummary = 'A public garbage bin is overflowing with domestic waste spilling onto the surrounding walkway, with stray animal activity noted by the resident.';
    urgencyLevel = 'needs_prompt_attention';
    dryPct = 45;
    wetPct = 45;
    cdPct = 5;
    hazPct = 5;

    userFacts.push('Waste has reportedly been accumulating for four days without scheduled clearance.');
    userFacts.push('Stray animals observed scattering decomposing waste onto public thoroughfare.');
    
    if (image) {
      imageObservations.push('Overfilled metal/plastic municipal bin with refuse spilling over rims.');
      imageObservations.push('Plastic packaging, organic food remnants, and cartons strewn within 3-meter radius.');
      
      boundingBoxes.push({
        box_2d: [280, 260, 780, 740],
        label: 'Overflowing Municipal Dump Bin',
        confidence: 0.94,
        category: 'overflowing_bin'
      });
      boundingBoxes.push({
        box_2d: [610, 120, 940, 880],
        label: 'Scattered Plastic Litter & Food Remnants',
        confidence: 0.88,
        category: 'scattered_waste'
      });
    } else {
      uncertainties.push('Photographic evidence not provided; severity determined from resident statement.');
    }

    aiInferences.push('Potential breeding ground for pests and flies due to exposed biodegradable waste.');
    aiInferences.push('Possible interruption of daily municipal solid waste collection schedule for this sector.');

    recommendedActions.push({ step: 1, action: 'Confirm nearest municipal ward and street landmark', purpose: 'Enables sanitary inspector to locate bin.' });
    recommendedActions.push({ step: 2, action: 'Submit grievance via municipal 311 portal or Swachhata app', purpose: 'Generates tracked ticket with 24-48 hr SLA.' });
  } else if (lower.includes('construction') || lower.includes('dumping') || lower.includes('debris') || lower.includes('school')) {
    category = 'illegal_dumping';
    issueTitle = 'Illegal Dumping of Construction Waste & Road Obstruction';
    problemSummary = 'Unauthorized dumping of construction debris and bulky waste alongside a public road, obstructing vehicular and pedestrian passage near school.';
    urgencyLevel = 'potentially_urgent';
    dryPct = 10;
    wetPct = 5;
    cdPct = 80;
    hazPct = 5;

    userFacts.push('Repeated unauthorized dumping of construction debris along public right-of-way.');
    userFacts.push('Obstruction causing traffic congestion and endangering pedestrians near school.');

    if (image) {
      imageObservations.push('Piles of concrete fragments, plaster, sandbags, and broken brickwork along roadway shoulder.');
      boundingBoxes.push({
        box_2d: [380, 150, 880, 840],
        label: 'C&D Concrete Rubble & Debris Heap',
        confidence: 0.96,
        category: 'construction_debris'
      });
      boundingBoxes.push({
        box_2d: [680, 40, 980, 600],
        label: 'Footpath Obstruction Hazard',
        confidence: 0.89,
        category: 'obstruction'
      });
    }

    aiInferences.push('Violation of Construction & Demolition (C&D) Waste Management Rules 2016.');
    recommendedActions.push({ step: 1, action: 'Report violation under C&D Waste Rules to Municipal Engineering Wing', purpose: 'Deputes heavy lifting machinery.' });
  } else if (lower.includes('drain') || lower.includes('water') || lower.includes('rain') || lower.includes('plastic')) {
    category = 'blocked_drainage';
    issueTitle = 'Plastic Waste Clogging Stormwater Drain & Waterlogging Risk';
    problemSummary = 'Accumulated non-biodegradable plastic waste and silt obstructing the stormwater drain, causing stagnant water accumulation outside building.';
    urgencyLevel = 'potentially_urgent';
    dryPct = 65;
    wetPct = 15;
    cdPct = 15;
    hazPct = 5;

    userFacts.push('Plastic waste choking public drainage channel.');
    userFacts.push('Water pooling near building entrance following rainfall.');

    if (image) {
      imageObservations.push('Drainage grating choked with single-use plastic bags and silt.');
      boundingBoxes.push({
        box_2d: [420, 200, 860, 790],
        label: 'Choked Stormwater Grate (Plastic Bags & Silt)',
        confidence: 0.93,
        category: 'choked_grate'
      });
      boundingBoxes.push({
        box_2d: [630, 80, 960, 910],
        label: 'Stagnant Water Pool (Vector Hazard)',
        confidence: 0.91,
        category: 'waterlogging'
      });
    }

    aiInferences.push('Risk of vector-borne illnesses (dengue, chikungunya) due to water stagnation.');
    recommendedActions.push({ step: 1, action: 'Log urgent drain desilting request with Municipal Stormwater Drain Department', purpose: 'Mechanized desilting clearance.' });
  } else {
    category = 'general_sanitation';
    issueTitle = text.slice(0, 45) || 'Public Sanitation Concern';
    problemSummary = text.slice(0, 150) || 'Resident reported public cleanliness issue requiring municipal inspection.';
    urgencyLevel = 'routine';
    userFacts.push(text || 'Sanitation complaint submitted by citizen.');
    if (audio) userFacts.push('Voice note context submitted by citizen.');
    if (image) {
      boundingBoxes.push({
        box_2d: [350, 200, 800, 800],
        label: 'Accumulated Waste Heap',
        confidence: 0.85,
        category: 'general_waste'
      });
    }
    recommendedActions.push({ step: 1, action: 'Verify ward depot', purpose: 'Ensures correct beat supervisor dispatch.' });
  }

  if (!city) missingInfo.push('City name and administrative municipal zone');
  if (!neighborhood) missingInfo.push('Neighborhood / Ward name');
  if (!landmark) missingInfo.push('Specific landmark or street pole number');

  const englishSubject = `Urgent Grievance: ${issueTitle} at ${locationStr}`;
  const englishBody = `To,
The Competent Authority / Assistant Commissioner,
Department of Solid Waste Management & Public Health,
Local Municipal Corporation

Respected Sir/Madam,

Subject: Urgent grievance regarding ${issueTitle.toLowerCase()} at ${locationStr}

I am writing to formally report a serious sanitation issue at the following location:
- Location / Landmark: ${locationStr}
- Category of Issue: ${category.replace('_', ' ').toUpperCase()}
- Current Status: ${problemSummary}

Key Observations & Reported Facts:
${userFacts.map(f => `- ${f}`).join('\n')}
${imageObservations.map(o => `- Visual evidence: ${o}`).join('\n')}

Under the Solid Waste Management Rules 2016 and the applicable Municipal Citizen Charter, urban local bodies are obligated to maintain clean and hygienic public premises. The present condition poses sanitation risks and inconvenience to local residents and commuters.

Requested Remedial Actions:
1. Immediate deputation of a sanitation squad to clear and sanitize the spot.
2. Desilting / bin replacement / debris removal as applicable.
3. Imposition of penal action or deployment of regular monitoring to deter recurrent violations.

Kindly issue a formal grievance acknowledgement number and advise the resolution timeline.

Yours sincerely,
A Concerned Resident
Date: ${new Date().toLocaleDateString('en-IN')}`;

  const hindiSubject = `शिकायत पत्र: ${locationStr} पर ${issueTitle} के निस्तारण हेतु`;
  const hindiBody = `सेवा में,
श्रीमान सहायक आयुक्त / वार्ड स्वास्थ्य अधिकारी,
ठोस अपशिष्ट प्रबंधन एवं लोक स्वास्थ्य विभाग,
संबंधित नगर निगम।

विषय: ${locationStr} पर ${issueTitle} के तत्काल निस्तारण हेतु शिकायत पत्र।

महोदय / महोदया,

सविनय निवेदन है कि उपरोक्त उल्लिखित स्थान (${locationStr}) पर स्वच्छता की अत्यंत गंभीर समस्या बनी हुई है।
- समस्या का प्रकार: ${category.replace('_', ' ').toUpperCase()}
- संक्षिप्त विवरण: ${problemSummary}

मुख्य बिंदु एवं नागरिक साक्ष्य:
${userFacts.map(f => `• ${f}`).join('\n')}
${imageObservations.map(o => `• दृश्य साक्ष्य: ${o}`).join('\n')}

ठोस अपशिष्ट प्रबंधन नियम 2016 (SWM Rules 2016) तथा नगर निगम नागरिक घोषणा पत्र के अंतर्गत सार्वजनिक मार्गों एवं नालियों को स्वच्छ रखना निगम का वैधानिक कर्तव्य है। वर्तमान स्थिति से स्थानीय निवासियों के स्वास्थ्य को गंभीर खतरा है।

निवेदित कार्यवाही:
1. तत्काल सफाई दल को मौके पर भेजकर कचरे का पूर्ण निस्तारण कराया जाए।
2. कीटनाशक / चूना पाउडर का छिड़काव किया जाए।
3. पुनरावृत्ति रोकने हेतु नियमित निगरानी की जाए।

कृपया इस शिकायत का आधिकारिक टोकन नंबर जारी कर समयबद्ध समाधान सुनिश्चित करें।

भवदीय,
जागरूक नागरिक
दिनांक: ${new Date().toLocaleDateString('hi-IN')}`;

  const kannadaSubject = `ದೂರು ಅರ್ಜಿ: ${locationStr} ನಲ್ಲಿ ${issueTitle} ತ್ವರಿತ ವಿಲೇವಾರಿಗಾಗಿ`;
  const kannadaBody = `ಗೆ,
ಮಾನ್ಯ ಸಹಾಯಕ ಕಾರ್ಯಪಾಲಕ ಎಂಜಿನಿಯರ್ (ಘನತ್ಯಾಜ್ಯ ನಿರ್ವಹಣೆ) / ಕಿರಿಯ ಆರೋಗ್ಯ ಪರಿವೀಕ್ಷಕರು,
ಬೃಹತ್ ಬೆಂಗಳೂರು ಮಹಾನಗರ ಪಾಲಿಕೆ (BBMP) / ಸ್ಥಳೀಯ ನಗರಸಭೆ.

ವಿಷಯ: ${locationStr} ನಲ್ಲಿ ${issueTitle} ಬಗ್ಗೆ ತುರ್ತು ದೂರು ಅರ್ಜಿ.

ಮಾನ್ಯರೇ,
ನಮ್ಮ ಬಡಾವಣೆಯ ಮೇಲ್ಕಂಡ ಸ್ಥಳದಲ್ಲಿ (${locationStr}) ಕಸ ಸಂಗ್ರಹಣೆಯಾಗದೆ ಸಾರ್ವಜನಿಕರಿಗೆ ತೀವ್ರ ತೊಂದರೆಯಾಗುತ್ತಿದೆ. 
ವಿವರಣೆ: ${problemSummary}

ಪ್ರಮುಖ ಅಂಶಗಳು:
${userFacts.map(f => `• ${f}`).join('\n')}

ಕರ್ನಾಟಕ ಸಕಾಲ ಸೇವೆಗಳ ಕಾಯ್ದೆ 2011 ಮತ್ತು ಘನತ್ಯಾಜ್ಯ ನಿರ್ವಹಣಾ ನಿಯಮಾವಳಿ 2016 ರ ಪ್ರಕಾರ, ಸಾರ್ವಜನಿಕ ರಸ್ತೆ ಹಾಗೂ ಡಸ್ಟ್‌ಬಿನ್ ಪ್ರದೇಶಗಳನ್ನು 24 ಗಂಟೆಯೊಳಗೆ ಸ್ವಚ್ಛಗೊಳಿಸುವುದು ಪಾಲಿಕೆಯ ಕರ್ತವ್ಯವಾಗಿದೆ.

ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ಪೌರಕಾರ್ಮಿಕರ ತಂಡವನ್ನು ಕಳುಹಿಸಿ ಕಸವನ್ನು ತೆರವುಗೊಳಿಸಿ ಬ್ಲೀಚಿಂಗ್ ಪೌಡರ್ ಸಿಂಪಡಿಸಬೇಕಾಗಿ ವಿನಂತಿ.

ಧನ್ಯವಾದಗಳೊಂದಿಗೆ,
ಜಾಗೃತ ನಾಗರಿಕರು,
ದಿನಾಂಕ: ${new Date().toLocaleDateString('en-IN')}`;

  const tamilSubject = `புகார் மனு: ${locationStr} பகுதியில் ${issueTitle} அகற்றுவது தொடர்பாக`;
  const tamilBody = `பெறுநர்:
உதவி ஆணையர் / சுகாதார ஆய்வாளர் அவர்கள்,
திடக்கழிவு மேலாண்மைத் துறை, பெருநகர சென்னை மாநகராட்சி (GCC).

பொருள்: ${locationStr} பகுதியில் ${issueTitle} உடனடியாக தூய்மை செய்யக் கோருதல்.

ஐயா / அம்மா,
எங்கள் பகுதியில் மேற்கண்ட இடத்தில் (${locationStr}) நீண்ட நாட்களாக குப்பைகள் தேங்கி சுகாதார சீர்கேடு ஏற்பட்டுள்ளது.
விவரம்: ${problemSummary}

முக்கிய தகவல்கள்:
${userFacts.map(f => `• ${f}`).join('\n')}

திடக்கழிவு மேலாண்மை விதிகள் 2016-ன் கீழ் உடனடியாக தூய்மைப் பணியாளர்களை அனுப்பி குப்பைகளை அகற்றி, கிருமிநாசினி தெளிக்க நடவடிக்கை எடுக்குமாறு கேட்டுக்கொள்கிறேன்.

இப்படிக்கு,
பொதுமக்கள்
நாள்: ${new Date().toLocaleDateString('en-IN')}`;

  const teluguSubject = `ఫిర్యాదు పత్రం: ${locationStr} వద్ద ${issueTitle} పరిష్కారం కొరకు`;
  const teluguBody = `స్వీకర్త:
సహాయ కమిషనర్ / శానిటరీ ఇన్‌స్పెక్టర్ గారు,
ఘన వ్యర్థాల నిర్వహణ విభాగం, గ్రేటర్ హైదరాబాద్ మున్సిపల్ కార్పొరేషన్ (GHMC).

విషయం: ${locationStr} వద్ద ${issueTitle} తక్షణ నివారణ కొరకు ఫిర్యాదు.

ఆర్యా,
పై పేర్కొన్న ప్రాంతంలో (${locationStr}) చెత్త పేరుకుపోయి స్థానికులకు తీవ్ర అసౌకర్యం మరియు దుర్వాసన కలిగిస్తోంది.
సమస్య వివరము: ${problemSummary}

ముఖ్యాంశాలు:
${userFacts.map(f => `• ${f}`).join('\n')}

మున్సిపల్ సిటిజన్ చార్టర్ మరియు ఘన వ్యర్థాల నిర్వహణ నిబంధనలు 2016 ప్రకారం వెంటనే శానిటేషన్ సిబ్బందిని పంపి చెత్తను తొలగించి బ్లీచింగ్ చల్లాల్సిందిగా కోరుతున్నాము.

భవదీయుడు,
స్థానిక పౌరుడు
తేదీ: ${new Date().toLocaleDateString('en-IN')}`;

  const marathiSubject = `तक्रार अर्ज: ${locationStr} येथील ${issueTitle} त्वरित स्वच्छतेबाबत`;
  const marathiBody = `प्रति,
मा. सहाय्यक आयुक्त / आरोग्य निरीक्षक साहेब,
घनकचरा व्यवस्थापन विभाग, बृहन्मुंबई महानगरपालिका (BMC) / पुणे महानगरपालिका (PMC).

विषय: ${locationStr} येथील ${issueTitle} बाबत त्वरित कार्यवाही करणेबाबत.

महोदय,
सविनय विनंती आहे की आमच्या परिसरातील वरील ठिकाणी (${locationStr}) कचऱ्याचा मोठा ढीग साचला असून अस्वच्छतेमुळे रोगराईचा धोका निर्माण झाला आहे.
तपशील: ${problemSummary}

नागरिक निरीक्षणे:
${userFacts.map(f => `• ${f}`).join('\n')}

घनकचरा व्यवस्थापन नियम २०१६ आणि महानगरपालिका नागरिक सनदेनुसार या ठिकाणचा कचरा २४ तासांच्या आत उचलून जंतुनाशक पावडर टाकण्यात यावी ही नम्र विनंती.

आपला नम्र नागरिक,
दिनांक: ${new Date().toLocaleDateString('en-IN')}`;

  const drafts = {
    en: { subject: englishSubject, body: englishBody },
    hi: { subject: hindiSubject, body: hindiBody },
    kn: { subject: kannadaSubject, body: kannadaBody },
    ta: { subject: tamilSubject, body: tamilBody },
    te: { subject: teluguSubject, body: teluguBody },
    mr: { subject: marathiSubject, body: marathiBody }
  };

  return {
    issue_title: issueTitle,
    category,
    problem_summary: problemSummary,
    input_types: inputTypes,
    location: {
      city,
      neighborhood,
      address: location.address || null,
      landmark,
      postcode: location.postcode || null,
      source: city ? 'user_provided' : 'not_provided',
      user_confirmation_required: !city || !landmark
    },
    observation: {
      user_reported_facts: userFacts,
      visible_image_observations: imageObservations,
      ai_inferences: aiInferences,
      uncertainties: uncertainties
    },
    bounding_boxes: boundingBoxes,
    waste_segregation_breakdown: {
      dry_recyclable_pct: dryPct,
      wet_biodegradable_pct: wetPct,
      construction_demolition_pct: cdPct,
      hazardous_sanitary_pct: hazPct,
      segregation_recommendations: [
        category === 'blocked_drainage' ? 'Single-use plastic bags choking silt traps. SWM 2016 plastic rules apply.' :
        category === 'illegal_dumping' ? 'Separate C&D debris from soil for transport to municipal processing plant.' :
        'Segregate organic food scraps to prevent decomposition methane buildup.'
      ]
    },
    urgency: {
      level: urgencyLevel,
      reasons: [
        `Impact on public health, transit, and SWM 2016 statutory compliance.`
      ],
      limitations: [
        'Urgency rating is generated from citizen inputs and visual indicators; does not replace statutory health department inspections.'
      ]
    },
    missing_information: missingInfo,
    recommended_actions: recommendedActions,
    verification_requirements: verificationReqs,
    complaint_drafts: drafts,
    complaint_draft: {
      subject: englishSubject,
      body: englishBody,
      subject_hindi: hindiSubject,
      body_hindi: hindiBody
    },
    _meta: {
      is_demo_mode: true,
      demo_notice: errMessage || 'Running in Sahaay AI Demo Mode (Configure GEMINI_API_KEY in server/.env for live AI calls).',
      analyzed_at: new Date().toISOString()
    }
  };
}
