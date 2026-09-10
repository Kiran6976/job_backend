import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const PDFParse = pdfParseModule.PDFParse || pdfParseModule;
import { uploadPdfToCloudinary } from "../utils/cloudinary.js";

/**
 * Prepares PDF text for AI extraction.
 * If text is within token limits (<= 150,000 chars), the full text is preserved.
 * For very large notifications (e.g. 80-100+ pages), it smartly preserves the header
 * (dates, vacancies, eligibility) and locates sections containing the Scheme of Examination,
 * Tier-I, Tier-II, Subjects, Papers, and Marking Schemes so no table is ever missed.
 */
const preparePdfTextForAI = (fullText, maxChars = 350000) => {
  if (!fullText || fullText.length <= maxChars) return fullText;

  const headerLimit = 40000;
  const headerText = fullText.substring(0, headerLimit);
  const remainingText = fullText.substring(headerLimit);

  const keywords = [
    /scheme of (?:the )?examination/i,
    /scheme of tier/i,
    /tier\s*[-–—]\s*(?:i|ii|1|2)/i,
    /pattern of (?:the )?examination/i,
    /selection (?:procedure|process|criteria)/i,
    /computer based (?:examination|mode|test)/i,
    /negative marking/i,
    /indicative syllabus/i,
    /syllabus for/i,
    /educational qualification/i,
    /age limit/i,
    // SSC & Standard Post/Organization tables
    /organization\s*(?:and\s*)?post/i,
    /post.*essential educational qualification/i,
    /essential educational qualification/i,
    /details of posts/i,
    /name of (?:the )?post/i,
    /name of (?:the )?department/i,
    /participating (?:departments|organizations|services)/i,
    /tentative vacanc/i,
    /service-wise/i,
    /cadre-wise/i,
    /central public works department/i,
    /military engineer services/i,
    /dgqa-naval/i,
    /farakka barrage/i,
    /national technical research organization/i,
    // Railway & Vacancy Table sections - capture all 21 regional RRBs
    /vacancy table/i,
    /rrb\s*[-–—:]\s*[a-z]+/i,
    /railway recruitment board/i,
    /rrb-wise/i,
    /railway\/pu-wise/i,
    /post-wise vacancies/i,
    /details of vacancies/i,
    /annexure.*vacanc/i,
    /annexure\s*[-–—:]?\s*[a-z0-9]+/i,
    /ahmedabad/i,
    /ajmer/i,
    /prayagraj|allahabad/i,
    /bangalore|bengaluru/i,
    /bhopal/i,
    /bhubaneswar/i,
    /bilaspur/i,
    /chandigarh/i,
    /chennai/i,
    /gorakhpur/i,
    /guwahati/i,
    /jammu.*srinagar/i,
    /kolkata/i,
    /malda/i,
    /mumbai/i,
    /muzaffarpur/i,
    /patna/i,
    /ranchi/i,
    /secunderabad/i,
    /siliguri/i,
    /thiruvananthapuram/i,
  ];

  const windows = [];
  keywords.forEach((regex) => {
    let match;
    const globalRegex = new RegExp(
      regex.source,
      regex.flags.includes("g") ? regex.flags : regex.flags + "g"
    );
    while ((match = globalRegex.exec(remainingText)) !== null) {
      const start = Math.max(0, match.index - 2000);
      const end = Math.min(remainingText.length, match.index + 20000);
      windows.push([start, end]);
      if (windows.length > 120) break;
    }
  });

  windows.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of windows) {
    if (merged.length === 0) {
      merged.push([start, end]);
    } else {
      const prev = merged[merged.length - 1];
      if (start <= prev[1] + 2000) {
        prev[1] = Math.max(prev[1], end);
      } else {
        merged.push([start, end]);
      }
    }
  }

  let targetedSections = "";
  for (const [start, end] of merged) {
    if (headerText.length + targetedSections.length >= maxChars) break;
    targetedSections +=
      "\n\n--- [EXAMINATION SCHEME & VACANCY DISTRIBUTION SECTION] ---\n" +
      remainingText.substring(start, end);
  }

  return headerText + targetedSections;
};

const EXTRACTION_PROMPT = (text) => `
You are an expert at thoroughly parsing Indian government recruitment notifications (SSC, UPSC, RRB, IBPS, State PSCs, Defence, etc.).
Extract ALL recruitment details and the complete EXAM PATTERN / SCHEME OF EXAMINATION from the text below.
Return ONLY a valid JSON object matching the exact structure specified below.

CRITICAL INSTRUCTIONS FOR EXAM PATTERN & PAPERS BREAKDOWN:
1. Locate sections titled "Scheme of Examination", "Scheme of Tier-I Examination", "Scheme of Tier-II Examination", "Pattern of Examination", "Selection Process", or any table listing Parts, Subjects, Questions, and Marks.
2. In "stageData.prelims.papers":
   - Extract EVERY individual Part / Paper / Section listed in the Tier-I / Prelims table.
   - "paper": Code or Part name (e.g. "Part I", "Part II", "Paper 1").
   - "subject": Full subject title (e.g. "English Language (Basic Knowledge)", "General Intelligence", "Quantitative Aptitude (Basic Arithmetic Skill)", "General Awareness").
   - "questions": Number of questions as string (e.g. "25").
   - "marks": Maximum marks as string (e.g. "50").
   - "duration": Duration string (e.g. "60 Minutes" or "15 minutes per section").
   - "nature": "Objective Type (MCQs)" or "Descriptive Type".
3. In "stageData.prelims.subjectsCovered":
   - List all subjects from the examination table as an array of strings (e.g. ["English Language (Basic Knowledge)", "General Intelligence", "Quantitative Aptitude", "General Awareness"]).
   - NEVER leave subjectsCovered empty if subjects or syllabus are mentioned in the notification!
4. If there is a Tier-II / Mains examination:
   - Extract all Tier-II sections, papers, or modules into "stageData.mains.papers" with their subjects, questions, marks, and duration.
5. Extract negative marking rules and duration accurately.
6. Extract Negative Marking & Marking Scheme details:
   - "negativeMarking.penalty": Penalty deducted for each wrong answer (e.g. "-0.50 marks", "-0.66 marks", "-1/3 mark").
   - "negativeMarking.advice": Exact candidate warning/advice from notification (e.g. "Candidates are, therefore, advised to keep this in mind while answering the questions." or "Candidates are advised to avoid guessing.").
   - "negativeMarking.text": Full negative marking sentence from notification (e.g. "There will be negative marking of 0.50 marks for each wrong answer.").
   - "markingScheme.correct": Marks awarded for each correct answer (e.g. "+2 marks").
   - "markingScheme.incorrect": Marks deducted for wrong answer (e.g. "-0.50 marks").
   - "markingScheme.unanswered": Marks for unanswered questions (e.g. "0 marks" or "No marks").
7. CRITICAL INSTRUCTIONS FOR RAILWAY (RRB) VACANCY TABLES:
   - Check if this notification is from Railway Recruitment Board (RRB) or contains a table titled "VACANCY TABLE", "RRB-wise, Railway/PU-wise & post-wise vacancies", or lists regional RRBs (e.g. Ahmedabad, Ajmer, Prayagraj/Allahabad, Bangalore/Bengaluru, Bhopal, Bhubaneswar, Bilaspur, Chandigarh, Chennai, Gorakhpur, Guwahati, Jammu-Srinagar, Kolkata, Malda, Mumbai, Muzaffarpur, Patna, Ranchi, Secunderabad, Siliguri, Thiruvananthapuram).
   - If it contains an RRB-wise vacancy table:
     * Set "vacancyTableType": "rrb".
     * YOU MUST EXTRACT EVERY SINGLE RRB BOARD PRESENT IN THE NOTIFICATION into "rrbVacancies".
     * DO NOT STOP after 2 or 3 boards! Continue extracting ALL regional RRB boards in the notification (e.g. RRB - AHMEDABAD, RRB - AJMER, RRB - BANGALORE, RRB - BHOPAL, RRB - BILASPUR, RRB - CHANDIGARH, RRB - CHENNAI, RRB - GORAKHPUR, RRB - GUWAHATI, RRB - JAMMU-SRINAGAR, RRB - KOLKATA, RRB - MALDA, RRB - MUMBAI, RRB - MUZAFFARPUR, RRB - PATNA, RRB - PRAYAGRAJ, RRB - RANCHI, RRB - SECUNDERABAD, RRB - SILIGURI, RRB - THIRUVANANTHAPURAM, etc.).
     * Standardize each RRB board name with the prefix "RRB - " followed by uppercase city name.
     * TO FIT ALL 21 BOARDS AND 400+ POSTS IN ONE RESPONSE, OUTPUT EACH POST AS A COMPACT 13-ELEMENT ARRAY IN "posts":
       Format: [catNo, postName, department, subDepartment, railway, ur, sc, st, obc, ews, total, exsm, pwbd]
       Index 0 (string): Category number string (e.g. "6", "7", "8", "17")
       Index 1 (string): Exact post title (e.g. "JUNIOR ENGINEER / ELECTRICAL / EMU")
       Index 2 (string): Department (e.g. "ELECTRICAL", "ENGINEERING", "MECHANICAL", "S and T", "STORES")
       Index 3 (string): Sub-Department (e.g. "EMU", "GENERAL SERVICES", "TRD", "P. WAY", "WORKS", "WORKSHOP")
       Index 4 (string): Railway Zone abbreviation (e.g. "WR", "CR", "NR", "ER", "SR", "NWR", "WCR", "SCR")
       Index 5 (number): UR vacancies (e.g. 7)
       Index 6 (number): SC vacancies (e.g. 3)
       Index 7 (number): ST vacancies (e.g. 1)
       Index 8 (number): OBC vacancies (e.g. 7)
       Index 9 (number): EWS vacancies (e.g. 2)
       Index 10 (number): Total vacancies (e.g. 20)
       Index 11 (number): Ex-SM vacancies (e.g. 2)
       Index 12 (number): PwBD vacancies (e.g. 1)
     * Example:
       ["6", "JUNIOR ENGINEER / ELECTRICAL / EMU", "ELECTRICAL", "EMU", "WR", 0, 0, 1, 0, 1, 2, 0, 0]
     * Also populate "categoryVacancies" (overall UR, OBC, SC, ST, EWS sums) and "vacancies" with the grand total count.
   - If it is NOT an RRB exam:
     * Set "vacancyTableType": "standard"
     * Set "rrbVacancies": []
8. EXTRACT APPLICATION FEE DETAILS:
   - Look for sections titled "Application Fee", "Fee", "Examination Fee", "Fee Payment", or any table listing fee amounts.
   - Extract category-wise fee amounts:
     * "general": Fee for General/UR/All candidates (e.g. "500", "100")
     * "sc_st_pwd_female_exsm": Reduced fee for SC/ST/PwBD/Female/Ex-SM/Minorities/EBC (e.g. "250", "0")
     * "exempted": Fee for fully exempted categories (e.g. "0" or "" if not mentioned separately)
     * "refundPolicy": Full refund policy text from notification (e.g. "Fee refunded on appearing in 1st Stage CBT")
     * "paymentMode": Payment mode mentioned (e.g. "Online", "SBI Challan / Net Banking / Debit Card / Credit Card / UPI")
     * "note": Any additional fee note (e.g. "Only candidates who appear in 1st stage CBT will get refund")
   - If no fee is mentioned, set "applicationFee": null.
9. CRITICAL INSTRUCTIONS FOR SERVICE-WISE / POST-WISE VACANCY DISTRIBUTION & QUALIFICATIONS (SSC, UPSC, CENTRAL MINISTRIES, STATE PSCs):
   - For non-RRB recruitment (e.g. SSC, UPSC, Central Government Ministries, State PSCs):
     Look for any table or section listing:
     * "Organization", "Post", "Essential Educational Qualifications", "Age limit" (e.g. as in SSC JE, SSC CGL, SSC CHSL notifications where tables list S. No. | Organization | Post | Essential Educational Qualifications | Age limit).
     * IMPORTANT: Where an Organization has multiple posts (for example, row 1 "Border Roads Organization" with "JE(C)" and "JE (E & M)", row 4 "Central Public Works Department (CPWD)" with "JE (E)" and "JE (C)", or row 6 "DGQA-NAVAL" with "JE(M)" and "JE(E)", or row 9 "Military Engineer Services (MES)" with "JE (C)" and "JE (E & M)"), YOU MUST EXTRACT EACH POST AS A SEPARATE INDIVIDUAL ENTRY!
     * Format the service name clearly by joining the Organization and Post: e.g.
       - "Border Roads Organization - JE(C)"
       - "Border Roads Organization - JE (E & M)"
       - "Brahmaputra Board, Ministry of Jal Shakti - JE (C)"
       - "Central Water Commission - JE (M)"
       - "Central Water Commission - JE (C)"
       - "Central Public Works Department (CPWD) - JE (Electrical)"
       - "Central Public Works Department (CPWD) - JE (Civil)"
       - "Central Water and Power Research Station - JE (Electrical)"
       - "Central Water and Power Research Station - JE (Civil)"
       - "DGQA-NAVAL, Ministry of Defence - JE (Mechanical)"
       - "DGQA-NAVAL, Ministry of Defence - JE (Electrical)"
       - "Farakka Barrage Project, Ministry of Jal Shakti - JE (Electrical)"
       - "Farakka Barrage Project, Ministry of Jal Shakti - JE (Civil)"
       - "Military Engineer Services (MES) - JE (Civil)"
       - "Military Engineer Services (MES) - JE (Electrical & Mechanical)"
       - "National Technical Research Organization (NTRO) - JE (Civil)"
       - "Director General of Lighthouses & Lightships - JE (Civil)"
       - "Director General of Lighthouses & Lightships - JE (Electrical)"
     * CRITICAL FOR ESSENTIAL EDUCATIONAL QUALIFICATIONS:
       Extract the EXACT Educational Qualification requirement from the "Essential Educational Qualifications" column into "qualification" (or "educationalQualification").
       For example:
       - "Degree in Civil Engineering from a recognized University/Institute; Or (a) Three-Year Diploma in Civil Engineering from a recognized University/ Institute/ Board; and (b) Two years of working experience in Planning/ Execution/ Maintenance of Civil Engineering works"
       - "Degree in Electrical or Mechanical Engineering from a recognized University/Institute; Or (a) Three-year Diploma in Electrical/ Automobile/ Mechanical Engineering from a recognized University/ Institute/ Board; and (b) Two-Year experience in Planning/ Execution/ Maintenance of Electrical or Mechanical Engineering works"
       - "Three-Year Diploma in Civil Engineering from a recognized University or Institution."
       - "Bachelor’s Degree or Diploma in Mechanical Engineering from a recognized University or Institution"
     * CRITICAL FOR AGE LIMIT:
       Extract the age limit requirement for that post from the "Age limit" column into "ageLimit" (e.g. "Up to 30 years", "Up to 32 Years").
     * Vacancy counts (ur, obc, sc, st, ews, total):
       Since many SSC notifications (like SSC JE) list qualifications per post but do not give per-post vacancy breakups in this table, set ur: 0, obc: 0, sc: 0, st: 0, ews: 0, total: 0 unless explicit numerical vacancy counts for that specific service/post are provided in the notification.
   - EXTRACT ALL OF THESE INTO "serviceVacancies".
   - Each item in "serviceVacancies" must follow:
     {
       "sNo": 1,
       "service": "Combined Organization - Post Name",
       "organization": "Organization Name (e.g. Border Roads Organization)",
       "post": "Post Name (e.g. JE(C))",
       "qualification": "Essential Educational Qualifications text from table",
       "ageLimit": "Age limit text from table (e.g. Up to 30 years)",
       "ur": 0,
       "obc": 0,
       "sc": 0,
       "st": 0,
       "ews": 0,
       "total": 0
     }
   - NEVER return "serviceVacancies": [] if an Organization/Post table exists in the notification!
   - Set "participatingServices": string count of how many services/posts were extracted (e.g. "16").

NOTIFICATION TEXT:
"""
${text}
"""

Return this exact JSON structure:
{
  "title": "Full official exam/job title",
  "organization": "Full organization name (e.g. Staff Selection Commission or Union Public Service Commission or Railway Recruitment Board)",
  "category": "Government Exams",
  "level": "National Level",
  "salary": "Pay scale string e.g. Pay Level-2 (Rs. 19,900 - 63,200)",
  "vacancies": "Total vacancies count as string (e.g. '3712')",
  "notificationDate": "YYYY-MM-DD or null",
  "applicationStartDate": "YYYY-MM-DD or null",
  "applicationLastDate": "YYYY-MM-DD or null",
  "examDate": "YYYY-MM-DD or null",
  "educationalQualification": "Full eligibility/qualification text",
  "ageLimitMin": "Minimum age as string e.g. 18",
  "ageLimitMax": "Maximum age as string e.g. 27",
  "ageLimitAsOn": "YYYY-MM-DD or null",
  "nationality": "Nationality requirement text",
  "numberAttempts": "Permitted attempts if mentioned",
  "importantNote": "Key notification instruction or important clause",
  "aboutOrg": "Brief 1-2 sentences about the organization",
  "slogan": "Short motivational phrase related to this exam (max 5 words)",
  "applyUrl": "Official apply URL if mentioned, else null",
  "officialWebsite": "Official organization website URL if mentioned",
  "postsDescription": "Description of posts (e.g. Lower Division Clerk, Junior Secretariat Assistant, Data Entry Operator)",
  "selectionStages": "e.g. Tier-I (CBT) • Tier-II (CBT & Skill Test)",
  "participatingServices": "Number of participating departments or RRB boards if applicable",
  "vacancyTableType": "standard or rrb",
  "rrbVacancies": [
    {
      "rrb": "RRB - AHMEDABAD",
      "posts": [
        ["6", "JUNIOR ENGINEER / ELECTRICAL / EMU", "ELECTRICAL", "EMU", "WR", 0, 0, 1, 0, 1, 2, 0, 0]
      ]
    }
  ],
  "serviceVacancies": [
    {
      "sNo": 1,
      "service": "Border Roads Organization - JE(C)",
      "organization": "Border Roads Organization",
      "post": "JE(C)",
      "qualification": "Degree in Civil Engineering from a recognized University/Institute; Or (a) Three-Year Diploma in Civil Engineering...",
      "ageLimit": "Up to 30 years",
      "ur": 0,
      "obc": 0,
      "sc": 0,
      "st": 0,
      "ews": 0,
      "total": 0
    }
  ],
  "categoryVacancies": {
    "ur": "number or empty string",
    "obc": "number or empty string",
    "sc": "number or empty string",
    "st": "number or empty string",
    "ews": "number or empty string",
    "pwbd": "number or empty string"
  },
  "examPattern": {
    "officialNote": "Official note or instructions about the exam pattern",
    "prelimsSyllabusUrl": "",
    "mainsSyllabusUrl": "",
    "stageData": {
      "prelims": {
        "stageTitle": "e.g. Tier-I Computer Based Examination",
        "stageBadge": "Stage 1 • Objective CBT",
        "stageDescription": "Overview of Tier-I / Preliminary examination",
        "papers": [
          {
            "paper": "Part I",
            "subject": "English Language (Basic Knowledge)",
            "questions": "25",
            "marks": "50",
            "duration": "60 Minutes",
            "nature": "Objective Type (MCQs)"
          }
        ],
        "keyPoints": [
          "Computer Based Examination mode",
          "Objective type multiple choice questions",
          "Negative marking for wrong answers"
        ],
        "subjectsCovered": [
          "English Language (Basic Knowledge)",
          "General Intelligence",
          "Quantitative Aptitude",
          "General Awareness"
        ],
        "markingScheme": {
          "correct": "+2 marks",
          "incorrect": "-0.50 marks",
          "unanswered": "0 marks",
          "totalMarks": "200"
        },
        "negativeMarking": {
          "penalty": "-0.50 marks",
          "advice": "Candidates are, therefore, advised to keep this in mind while answering the questions.",
          "text": "There will be negative marking of 0.50 marks for each wrong answer.",
          "penaltyLabel": "for each wrong answer",
          "enabled": true
        },
        "quote": "Success favors the prepared mind."
      },
      "mains": {
        "stageTitle": "e.g. Tier-II Computer Based Examination",
        "stageBadge": "Stage 2 • CBT & Skill Test",
        "stageDescription": "Overview of Tier-II / Main examination",
        "papers": [],
        "keyPoints": [],
        "subjectsCovered": [],
        "markingScheme": {
          "correct": "",
          "incorrect": "",
          "unanswered": "0 marks",
          "totalMarks": ""
        },
        "negativeMarking": {
          "penalty": "",
          "advice": "",
          "text": "",
          "penaltyLabel": "for each wrong answer",
          "enabled": false
        },
        "quote": "Tier-II requires accuracy and time management."
      },
      "interview": {
        "stageTitle": "Document Verification & Skill Test",
        "stageBadge": "Final Evaluation",
        "stageDescription": "Document verification and skill/typing test.",
        "papers": [],
        "keyPoints": ["Qualifying in nature"],
        "subjectsCovered": [],
        "markingScheme": {
          "correct": "",
          "incorrect": "",
          "unanswered": "N/A",
          "totalMarks": ""
        },
        "negativeMarking": {
          "penalty": "0 marks",
          "advice": "No negative marking applies.",
          "text": "No negative marking applies.",
          "penaltyLabel": "no penalty",
          "enabled": false
        },
        "quote": "Confidence and authenticity shine through."
      }
    }
  },
  "applicationFee": {
    "general": "500",
    "sc_st_pwd_female_exsm": "250",
    "exempted": "0",
    "refundPolicy": "Fee refunded on appearing in 1st Stage CBT",
    "paymentMode": "Online",
    "note": "Only candidates who appear in 1st CBT will get refund"
  }
}
`;


export const parsePdfWithAI = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No PDF file uploaded." });
    }

    const pdfBuffer = req.file.buffer;

    // Step 1: Upload PDF to Cloudinary
    let pdfUrl = null;
    try {
      const cloudResult = await uploadPdfToCloudinary(pdfBuffer, req.file.originalname);
      pdfUrl = cloudResult.secure_url;
    } catch (cloudErr) {
      console.warn("Cloudinary upload failed (non-fatal):", cloudErr.message);
    }

    // Step 2: Extract text from PDF buffer
    let extractedText = "";
    try {
      if (typeof PDFParse === "function") {
        try {
          const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
          const res = await parser.getText();
          extractedText = res?.text || "";
          if (parser.destroy) await parser.destroy();
        } catch (clsErr) {
          console.warn("Class invocation failed, trying function invocation:", clsErr.message);
          const res = await PDFParse(pdfBuffer);
          extractedText = res?.text || "";
        }
      }
    } catch (parseErr) {
      console.warn("pdf-parse failed:", parseErr.message);
    }

    console.log("Extracted PDF raw text length:", extractedText ? extractedText.length : 0);

    if (!extractedText || extractedText.trim().length < 15) {
      return res.status(422).json({
        success: false,
        message:
          "Could not extract text from this PDF. Please ensure the notification PDF contains selectable text (not an un-OCR'd scan).",
        pdfUrl,
      });
    }

    // Step 3: Prepare text targeting exam pattern and critical sections
    const preparedText = preparePdfTextForAI(extractedText);
    console.log("Prepared text length for AI prompt:", preparedText.length);

    // Step 4: Call Gemini AI with candidate models fallback
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "GEMINI_API_KEY is not set in Server/.env",
        pdfUrl,
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];
    const prompt = EXTRACTION_PROMPT(preparedText);

    let parsedData = null;
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`Attempting AI extraction with model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 65536,
          },
        });
        const aiResult = await model.generateContent(prompt);
        const rawResponse = aiResult.response.text().trim();
        const cleaned = rawResponse
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        parsedData = JSON.parse(cleaned);
        console.log(`AI extraction successful with ${modelName}`);
        break;
      } catch (err) {
        console.warn(`Model ${modelName} failed:`, err.message);
        lastError = err;
      }
    }

    if (!parsedData) {
      return res.status(502).json({
        success: false,
        message: "AI parsing failed across candidate models: " + (lastError?.message || "Unknown error"),
        pdfUrl,
      });
    }

    // Step 5: Normalize parsed exam pattern & papers
    if (parsedData.examPattern && parsedData.examPattern.stageData) {
      ["prelims", "mains", "interview"].forEach((stageKey) => {
        const stage = parsedData.examPattern.stageData[stageKey];
        if (stage) {
          // Normalize papers array
          if (Array.isArray(stage.papers)) {
            stage.papers = stage.papers.map((p, idx) => ({
              paper: String(p.paper || p.name || p.part || p.section || `Part ${idx + 1}`),
              subject: String(p.subject || p.name || p.paper || ""),
              questions: String(p.questions !== undefined && p.questions !== null ? p.questions : ""),
              marks: String(p.marks !== undefined && p.marks !== null ? p.marks : ""),
              duration: String(p.duration || ""),
              nature: String(p.nature || p.type || "Objective Type (MCQs)"),
            }));
          } else {
            stage.papers = [];
          }

          // Ensure subjectsCovered has all paper subjects if empty
          if (!Array.isArray(stage.subjectsCovered) || stage.subjectsCovered.length === 0) {
            stage.subjectsCovered = stage.papers
              .map((p) => p.subject)
              .filter(Boolean);
          } else {
            stage.subjectsCovered = stage.subjectsCovered.map(String).filter(Boolean);
          }

          // Ensure keyPoints is an array of strings
          if (!Array.isArray(stage.keyPoints)) {
            stage.keyPoints = stage.keyPoints ? [String(stage.keyPoints)] : [];
          }

          // Normalize negativeMarking
          const rawNm = stage.negativeMarking || {};
          let penalty = String(rawNm.penalty || rawNm.penaltyMarks || rawNm.penalty_marks || "");
          if (!penalty && rawNm.label) {
            const m = rawNm.label.match(/[\d.]+\s*marks?/i);
            if (m) penalty = m[0];
          }
          if (penalty && !penalty.startsWith("-") && !penalty.startsWith("+")) {
            penalty = `-${penalty}`;
          }
          if (penalty && !penalty.toLowerCase().includes("mark")) {
            penalty = `${penalty} marks`;
          }

          let advice = String(rawNm.advice || rawNm.candidateAdvice || rawNm.candidate_advice || "");
          let nmText = String(rawNm.text || rawNm.label || "");
          if (nmText && !advice && nmText.toLowerCase().includes("advised")) {
            advice = nmText;
          }
          if (!advice && penalty) {
            advice = "Candidates are, therefore, advised to keep this in mind while answering the questions.";
          }

          stage.negativeMarking = {
            penalty: penalty || "-0.50 marks",
            advice: advice || "Candidates are advised to avoid guessing.",
            text: nmText || (penalty ? `There will be negative marking of ${penalty.replace("-", "")} for each wrong answer.` : ""),
            penaltyLabel: String(rawNm.penaltyLabel || "for each wrong answer"),
            enabled: Boolean(penalty && penalty !== "0" && penalty !== "-0"),
          };

          // Normalize markingScheme
          const rawMs = stage.markingScheme || {};
          let correct = String(rawMs.correct || rawMs.correctMarks || rawMs.correct_marks || "");
          if (correct && !correct.startsWith("+") && !correct.startsWith("-")) {
            correct = `+${correct}`;
          }
          if (correct && !correct.toLowerCase().includes("mark")) {
            correct = `${correct} marks`;
          }

          let incorrect = String(rawMs.incorrect || rawMs.incorrectMarks || penalty || "");
          if (incorrect && !incorrect.startsWith("-")) {
            incorrect = `-${incorrect}`;
          }
          if (incorrect && !incorrect.toLowerCase().includes("mark")) {
            incorrect = `${incorrect} marks`;
          }

          stage.markingScheme = {
            correct: correct || "+2 marks",
            incorrect: incorrect || (penalty || "-0.50 marks"),
            unanswered: String(rawMs.unanswered || "0 marks"),
            totalMarks: String(rawMs.totalMarks || ""),
          };
        }
      });
    }

    // Step 6: Normalize RRB Vacancies if extracted (handles both compact array tuples and object representations)
    if (Array.isArray(parsedData.rrbVacancies) && parsedData.rrbVacancies.length > 0) {
      let grandUR = 0;
      let grandSC = 0;
      let grandST = 0;
      let grandOBC = 0;
      let grandEWS = 0;
      let grandTotal = 0;
      let grandExsm = 0;

      parsedData.rrbVacancies = parsedData.rrbVacancies.map((group) => {
        const rrbName = String(group.rrb || group.board || "RRB").trim();
        const rawPosts = Array.isArray(group.posts) ? group.posts : [];

        const posts = rawPosts.map((p, idx) => {
          let catNo, postName, department, subDepartment, railway;
          let ur = 0, sc = 0, st = 0, obc = 0, ews = 0, total = 0, exsm = 0, pwbd = 0;

          if (Array.isArray(p)) {
            // Compact Array Tuple: [catNo, postName, dept, subDept, rly, ur, sc, st, obc, ews, total, exsm, pwbd]
            catNo = String(p[0] !== undefined && p[0] !== null ? p[0] : idx + 1);
            postName = String(p[1] || "").trim();
            department = String(p[2] || "").trim();
            subDepartment = String(p[3] || "").trim();
            railway = String(p[4] || "").trim().toUpperCase();
            ur = parseInt(p[5], 10) || 0;
            sc = parseInt(p[6], 10) || 0;
            st = parseInt(p[7], 10) || 0;
            obc = parseInt(p[8], 10) || 0;
            ews = parseInt(p[9], 10) || 0;
            const calcTot = ur + sc + st + obc + ews;
            total = parseInt(p[10], 10) || calcTot || 0;
            exsm = parseInt(p[11], 10) || 0;
            pwbd = p[12] !== undefined && p[12] !== null ? p[12] : 0;
          } else if (p && typeof p === "object") {
            // Standard Object Representation
            catNo = String(p.catNo !== undefined && p.catNo !== null ? p.catNo : idx + 1);
            postName = String(p.postName || p.name || p.post || "").trim();
            department = String(p.department || p.dept || "").trim();
            subDepartment = String(p.subDepartment || p.subDept || "").trim();
            railway = String(p.railway || p.zone || p.rly || "").trim().toUpperCase();
            ur = parseInt(p.ur, 10) || 0;
            sc = parseInt(p.sc, 10) || 0;
            st = parseInt(p.st, 10) || 0;
            obc = parseInt(p.obc, 10) || 0;
            ews = parseInt(p.ews, 10) || 0;
            const calcTot = ur + sc + st + obc + ews;
            total = parseInt(p.total, 10) || calcTot || 0;
            exsm = parseInt(p.exsm, 10) || 0;
            pwbd = p.pwbd !== undefined && p.pwbd !== null ? p.pwbd : 0;
          } else {
            return null;
          }

          grandUR += ur;
          grandSC += sc;
          grandST += st;
          grandOBC += obc;
          grandEWS += ews;
          grandTotal += total;
          grandExsm += exsm;

          return {
            catNo,
            postName,
            department,
            subDepartment,
            railway,
            ur,
            sc,
            st,
            obc,
            ews,
            total,
            exsm,
            pwbd,
          };
        }).filter(Boolean);

        const subtotal = {
          ur: posts.reduce((a, b) => a + (b.ur || 0), 0),
          sc: posts.reduce((a, b) => a + (b.sc || 0), 0),
          st: posts.reduce((a, b) => a + (b.st || 0), 0),
          obc: posts.reduce((a, b) => a + (b.obc || 0), 0),
          ews: posts.reduce((a, b) => a + (b.ews || 0), 0),
          total: posts.reduce((a, b) => a + (b.total || 0), 0),
          exsm: posts.reduce((a, b) => a + (b.exsm || 0), 0),
        };

        return {
          rrb: rrbName,
          posts,
          subtotal,
        };
      });

      parsedData.vacancyTableType = "rrb";
      if (!parsedData.vacancies || parsedData.vacancies === "0") {
        parsedData.vacancies = String(grandTotal);
      }
      if (!parsedData.categoryVacancies || !parsedData.categoryVacancies.ur) {
        parsedData.categoryVacancies = {
          ur: grandUR,
          sc: grandSC,
          st: grandST,
          obc: grandOBC,
          ews: grandEWS,
        };
      }
    }

    // Step 7: Normalize Application Fee
    if (parsedData.applicationFee && typeof parsedData.applicationFee === "object") {
      const rawFee = parsedData.applicationFee;
      const general = String(rawFee.general || rawFee.ur || rawFee.allCandidates || "").trim();
      const reserved = String(rawFee.sc_st_pwd_female_exsm || rawFee.reserved || rawFee.reduced || "").trim();
      const exempted = String(rawFee.exempted || rawFee.exempt || "").trim();
      const refundPolicy = String(rawFee.refundPolicy || rawFee.refund || "").trim();
      const paymentMode = String(rawFee.paymentMode || rawFee.payment || "Online").trim();
      const note = String(rawFee.note || "").trim();

      if (general || reserved) {
        parsedData.applicationFee = {
          general,
          sc_st_pwd_female_exsm: reserved,
          exempted,
          refundPolicy,
          paymentMode,
          note,
        };
      } else {
        parsedData.applicationFee = null;
      }
    } else {
      parsedData.applicationFee = null;
    }

    // Step 8: Normalize Service-wise / Post-wise Vacancies & Qualifications (SSC, UPSC, etc.)
    if (Array.isArray(parsedData.serviceVacancies) && parsedData.serviceVacancies.length > 0) {
      parsedData.serviceVacancies = parsedData.serviceVacancies
        .map((s, idx) => {
          const organization = String(s.organization || "").trim();
          const post = String(s.post || s.postName || "").trim();
          let serviceName = String(
            s.service || s.name || s.postTitle || (organization && post ? `${organization} - ${post}` : organization || post) || `Service ${idx + 1}`
          ).trim();
          const qualification = String(s.qualification || s.essentialEducationalQualifications || s.educationalQualification || "").trim();
          const ageLimit = String(s.ageLimit || s.age || "").trim();
          const ur = parseInt(s.ur, 10) || 0;
          const obc = parseInt(s.obc, 10) || 0;
          const sc = parseInt(s.sc, 10) || 0;
          const st = parseInt(s.st, 10) || 0;
          const ews = parseInt(s.ews, 10) || 0;
          const total = parseInt(s.total, 10) || (ur + obc + sc + st + ews) || 0;
          return {
            sNo: s.sNo !== undefined && s.sNo !== null ? Number(s.sNo) : idx + 1,
            service: serviceName,
            organization: organization || (serviceName.includes(" - ") ? serviceName.split(" - ")[0].trim() : ""),
            post: post || (serviceName.includes(" - ") ? serviceName.split(" - ").slice(1).join(" - ").trim() : serviceName),
            qualification,
            ageLimit,
            ur,
            obc,
            sc,
            st,
            ews,
            total,
          };
        })
        .filter((s) => s.service.length > 0);

      if (!parsedData.participatingServices || parsedData.participatingServices === "0") {
        parsedData.participatingServices = String(parsedData.serviceVacancies.length);
      }
    } else {
      parsedData.serviceVacancies = [];
    }

    // Step 9: Default Media Branding if organization matches SSC or other known bodies
    if (parsedData.organization) {
      const orgLower = parsedData.organization.toLowerCase();
      if (orgLower.includes("staff selection commission") || orgLower === "ssc") {
        parsedData.bannerUrl = "/SSC.png";
        parsedData.logoUrl = "/Staff_Selection_Commission_Logo.jpg";
        if (!parsedData.slogan) parsedData.slogan = "Opportunities for a Brighter Tomorrow";
        if (!parsedData.subSlogan) parsedData.subSlogan = "Same Preparation, Bigger Opportunities";
      }
    }

    return res.status(200).json({

      success: true,
      message: "PDF parsed successfully",
      pdfUrl,
      parsedData,
      charCount: extractedText.length,
      preparedCharCount: preparedText.length,
    });
  } catch (err) {
    console.error("parsePdfWithAI error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

