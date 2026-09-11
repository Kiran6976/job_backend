import { Job } from "../model/job.model.js";
import { Category } from "../model/category.model.js";
import { Organization } from "../model/organization.model.js";
import {
  uploadLogoToCloudinary,
  uploadBannerToCloudinary,
  uploadPdfToCloudinary,
} from "../utils/cloudinary.js";
import { broadcastNewJobNotification } from "../utils/emailService.js";

// Initial seed categories matching Top Opportunities
const DEFAULT_CATEGORIES = [
  { name: "All Opportunities", slug: "all", icon: "grid", count: 0 },
  { name: "Government Exams", slug: "govt", icon: "building", count: 0 },
  { name: "Private Jobs", slug: "private", icon: "briefcase", count: 0 },
  { name: "Internships", slug: "internships", icon: "graduation-cap", count: 0 },
  { name: "Work From Home", slug: "wfh", icon: "laptop", count: 0 },
  { name: "State Govt. Jobs", slug: "state-govt", icon: "landmark", count: 0 },
  { name: "Teaching Jobs", slug: "teaching", icon: "book", count: 0 },
  { name: "Defense Jobs", slug: "defense", icon: "shield", count: 0 },
];

const DEFAULT_ORGANIZATIONS = [
  {
    name: "Union Public Service Commission",
    code: "UPSC",
    category: "Government Exams",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/200px-Emblem_of_India.svg.png",
    bannerUrl: "/UPSC.png",
    about:
      "Join the prestigious Civil Services and be a part of nation building. Serve the country and create a meaningful impact through policy making, governance and public welfare.",
    slogan: "Serve Lead Bring Change",
    subSlogan: "A Stronger India Needs You",
    selectionStages: "Prelims • Mains • Interview",
    officialWebsite: "https://upsc.gov.in",
  },
  {
    name: "Railway Recruitment Board",
    code: "RRB",
    category: "Government Exams",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/4/45/Indian_Railways_logo.svg/200px-Indian_Railways_logo.svg.png",
    bannerUrl: "/Job_Hero.png",
    about:
      "Indian Railways is the fourth largest railway network in the world. Joining RRB connects you with the lifeline of the nation.",
    slogan: "Lifeline of the Nation",
    subSlogan: "Engineering India's Future",
    selectionStages: "CBT 1 • CBT 2 • Document Verification",
    officialWebsite: "https://indianrailways.gov.in",
  },
  {
    name: "Institute of Banking Personnel Selection",
    code: "IBPS",
    category: "Government Exams",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/IBPS_Logo.svg/200px-IBPS_Logo.svg.png",
    bannerUrl: "/Job_Second.png",
    about:
      "IBPS facilitates recruitment for Public Sector Banks across India providing stable, respected banking careers.",
    slogan: "Excellence in Assessment",
    subSlogan: "Empowering Financial Stability",
    selectionStages: "Prelims • Mains • Interview",
    officialWebsite: "https://ibps.in",
  },
  {
    name: "Staff Selection Commission",
    code: "SSC",
    category: "Government Exams",
    logoUrl: "/Staff_Selection_Commission_Logo.jpg",
    bannerUrl: "/SSC.png",
    about:
      "Staff Selection Commission (SSC) is an organization under Government of India to recruit staff for various posts in the various Ministries and Departments of the Government of India and in Subordinate Offices.",
    slogan: "Opportunities for a Brighter Tomorrow",
    subSlogan: "Same Preparation, Bigger Opportunities",
    selectionStages: "Tier 1 • Tier 2 • Document Verification",
    officialWebsite: "https://ssc.gov.in",
  },
  {
    name: "Indian Navy Recruitment Board",
    code: "Indian Navy",
    category: "Government Exams",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Emblem_of_the_Indian_Navy.svg/200px-Emblem_of_the_Indian_Navy.svg.png",
    bannerUrl: "/Hero_Image.png",
    about:
      "An elite combat-ready force ensuring the maritime security and supreme pride of the Republic of India.",
    slogan: "Sha-No Varuna",
    subSlogan: "Guardians of the Ocean",
    selectionStages: "Written Exam • PFT • Medical Test",
    officialWebsite: "https://joinindiannavy.gov.in",
  },
];

// ==========================================
// CATEGORIES
// ==========================================

export const getAllCategories = async (req, res) => {
  try {
    let categories = await Category.find().sort({ createdAt: 1 });

    // Seed defaults if collection is empty
    if (!categories || categories.length === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, count: 0 })));
      categories = await Category.find().sort({ createdAt: 1 });
    }

    // Dynamically compute real job counts from Job collection
    const totalJobs = await Job.countDocuments({});
    const categoryCounts = await Job.aggregate([
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$category" } } },
          total: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    categoryCounts.forEach((item) => {
      if (item._id) {
        countMap[item._id] = item.total;
      }
    });

    const updatedCategories = [];
    for (const cat of categories) {
      const catObj = cat.toObject ? cat.toObject() : { ...cat };
      let realCount = 0;
      if (catObj.slug === "all" || catObj.name.toLowerCase() === "all opportunities") {
        realCount = totalJobs;
      } else {
        const catKey = catObj.name.trim().toLowerCase();
        realCount = countMap[catKey] || 0;
      }
      catObj.count = realCount;
      updatedCategories.push(catObj);

      // Persist real count back to DB so stored data remains accurate
      if (cat.count !== realCount) {
        await Category.updateOne({ _id: cat._id }, { $set: { count: realCount } });
      }
    }

    return res.status(200).json({
      success: true,
      categories: updatedCategories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch categories.",
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    const trimmedName = name.trim();
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const existing = await Category.findOne({
      $or: [{ name: trimmedName }, { slug }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists.",
      });
    }

    const newCategory = await Category.create({
      name: trimmedName,
      slug,
      icon: icon || "grid",
      count: 0,
    });

    return res.status(201).json({
      success: true,
      message: `Category '${trimmedName}' created successfully.`,
      category: newCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create category.",
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Category '${category.name}' deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete category.",
    });
  }
};

// ==========================================
// JOBS & EXAM NOTIFICATIONS
// ==========================================

// Comprehensive dictionary for acronyms, exam abbreviations, and synonyms
const ACRONYM_SYNONYMS = {
  ssc: ["staff selection commission", "cgl", "chsl", "mts", "gd", "cpo", "je", "stenographer", "selection posts", "steno"],
  "staff selection commission": ["ssc", "cgl", "chsl", "mts", "gd", "cpo", "je", "stenographer"],
  cgl: ["combined graduate level", "ssc", "staff selection commission"],
  chsl: ["combined higher secondary", "ssc", "10+2", "12th", "staff selection commission"],
  mts: ["multi tasking staff", "ssc", "staff selection commission"],
  upsc: ["union public service commission", "civil services", "ias", "ips", "ifs", "nda", "cds", "capf", "ese", "cms", "cse"],
  "union public service commission": ["upsc", "civil services", "ias", "ips", "ifs", "nda", "cds", "capf"],
  ias: ["upsc", "civil services", "union public service commission"],
  ips: ["upsc", "civil services", "union public service commission"],
  ifs: ["upsc", "civil services", "union public service commission"],
  cse: ["upsc", "civil services", "union public service commission"],
  nda: ["national defence academy", "upsc", "defense", "defence"],
  cds: ["combined defence services", "upsc", "defense", "defence"],
  rrb: ["railway recruitment board", "railway", "railways", "indian railways", "ntpc", "group d", "alp", "rpf", "loco pilot"],
  railway: ["rrb", "railway recruitment board", "railways", "indian railways", "ntpc", "group d", "alp", "rpf"],
  railways: ["rrb", "railway recruitment board", "railway", "indian railways", "ntpc", "group d", "alp", "rpf"],
  "indian railways": ["rrb", "railway recruitment board", "railway", "railways", "ntpc", "group d", "alp", "rpf"],
  "railway recruitment board": ["rrb", "railway", "railways", "indian railways", "ntpc", "group d", "alp", "rpf"],
  ntpc: ["non technical popular categories", "rrb", "railway", "railways"],
  alp: ["assistant loco pilot", "rrb", "railway"],
  rpf: ["railway protection force", "rrb", "railway"],
  ibps: ["institute of banking personnel selection", "bank", "banking", "po", "clerk", "so", "probationary officer"],
  "institute of banking personnel selection": ["ibps", "bank", "banking", "po", "clerk", "so"],
  sbi: ["state bank of india", "bank", "banking", "po", "clerk"],
  "state bank of india": ["sbi", "bank", "banking"],
  rbi: ["reserve bank of india", "bank", "banking", "grade b", "assistant"],
  "reserve bank of india": ["rbi", "bank", "banking"],
  drdo: ["defence research and development organisation", "defence research and development organization", "defence", "defense", "ceptam"],
  "defence research and development organisation": ["drdo", "defense", "defence"],
  isro: ["indian space research organisation", "indian space research organization", "space"],
  "indian space research organisation": ["isro", "space"],
  nta: ["national testing agency", "neet", "jee", "cuet", "ugc net"],
  ctet: ["teacher eligibility test", "central teacher eligibility test", "teaching", "teacher"],
  tet: ["teacher eligibility test", "central teacher eligibility test", "teaching", "teacher"],
  gate: ["graduate aptitude test in engineering", "engineering", "engineer"],
  psc: ["public service commission", "state psc", "uppsc", "bpsc", "mppsc", "rpsc", "wbpsc", "tnpsc", "kpsc", "appsc", "opsc"],
  "public service commission": ["psc", "state psc", "uppsc", "bpsc", "mppsc", "rpsc", "wbpsc", "tnpsc", "kpsc"],
  uppsc: ["uttar pradesh public service commission", "psc"],
  bpsc: ["bihar public service commission", "psc"],
  mppsc: ["madhya pradesh public service commission", "psc"],
  rpsc: ["rajasthan public service commission", "psc"],
  wbpsc: ["west bengal public service commission", "psc"],
  tnpsc: ["tamil nadu public service commission", "psc"],
  kpsc: ["karnataka public service commission", "psc", "kerala public service commission"],
  "12th": ["class 12", "12th", "10+2", "class12", "higher secondary", "intermediate", "12th pass", "+2"],
  "class 12": ["12th", "10+2", "class12", "higher secondary", "intermediate", "12th pass", "+2"],
  "class12": ["12th", "class 12", "10+2", "higher secondary", "intermediate", "12th pass"],
  "10+2": ["class 12", "12th", "class12", "higher secondary", "intermediate", "12th pass", "chsl"],
  intermediate: ["class 12", "12th", "10+2", "class12", "higher secondary"],
  "higher secondary": ["class 12", "12th", "10+2", "class12", "intermediate", "chsl"],
  "10th": ["class 10", "10th", "class10", "matriculation", "matric", "secondary", "10th pass"],
  "class 10": ["10th", "class 10", "class10", "matriculation", "matric", "secondary", "10th pass", "mts"],
  class10: ["10th", "class 10", "matriculation", "matric", "secondary", "10th pass"],
  matric: ["class 10", "10th", "class10", "matriculation", "secondary"],
  matriculation: ["class 10", "10th", "class10", "matric", "secondary"],
  graduate: ["graduate", "graduation", "degree", "bachelor", "b.tech", "btech", "b.e", "be", "b.sc", "b.com", "b.a", "cgl"],
  graduation: ["graduate", "degree", "bachelor", "b.tech", "btech", "b.e", "be", "b.sc", "b.com", "b.a", "cgl"],
  engineering: ["engineer", "engineering", "b.tech", "btech", "b.e", "be", "diploma", "junior engineer", "assistant engineer", "je", "ae", "gate"],
  engineer: ["engineering", "engineer", "b.tech", "btech", "b.e", "be", "diploma", "junior engineer", "assistant engineer", "je", "ae", "gate"],
  teaching: ["teaching", "teacher", "faculty", "professor", "ctet", "tet", "pgt", "tgt", "prt", "lecturer"],
  teacher: ["teaching", "teacher", "faculty", "professor", "ctet", "tet", "pgt", "tgt", "prt", "lecturer"],
  defense: ["defense", "defence", "police", "army", "navy", "air force", "airforce", "nda", "cds", "afcat", "crpf", "bsf", "cisf", "itbp", "ssb", "capf", "constable", "si"],
  defence: ["defense", "defence", "police", "army", "navy", "air force", "airforce", "nda", "cds", "afcat", "crpf", "bsf", "cisf", "itbp", "ssb", "capf", "constable", "si"],
  police: ["police", "defense", "defence", "constable", "si", "sub inspector"],
  army: ["army", "defense", "defence", "agniveer", "nda", "cds"],
  navy: ["navy", "defense", "defence", "agniveer", "nda", "cds", "indian navy"],
  airforce: ["air force", "airforce", "defense", "defence", "agniveer", "afcat", "nda"],
  "air force": ["air force", "airforce", "defense", "defence", "agniveer", "afcat", "nda"],
};

// Helper: Extract acronym from text, e.g. "Staff Selection Commission" -> "SSC"
const getAcronym = (text) => {
  if (!text) return "";
  const words = String(text)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !["of", "and", "in", "the", "for", "to", "board", "commission"].includes(w.toLowerCase()));
  if (words.length <= 1) return "";
  return words.map((w) => w[0].toUpperCase()).join("");
};

// Helper: Normalize string
const normalizeStr = (str) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Helper: Get search tokens & aliases
const getSearchTokens = (query) => {
  if (!query) return [];
  const raw = String(query).toLowerCase().trim();
  const clean = raw.replace(/\b(jobs?|exams?|recruitment|vacancy|vacancies|posts?|forms?|online)\b/gi, "").trim();

  const tokens = new Set();
  if (raw) tokens.add(raw);
  if (clean) tokens.add(clean);

  const words = clean.split(/\s+/).filter(Boolean);
  words.forEach((w) => tokens.add(w));

  const currentTokens = Array.from(tokens);
  currentTokens.forEach((t) => {
    const tNorm = normalizeStr(t);
    if (ACRONYM_SYNONYMS[t]) {
      ACRONYM_SYNONYMS[t].forEach((alias) => tokens.add(alias.toLowerCase()));
    }
    Object.keys(ACRONYM_SYNONYMS).forEach((key) => {
      if (normalizeStr(key) === tNorm) {
        ACRONYM_SYNONYMS[key].forEach((alias) => tokens.add(alias.toLowerCase()));
      }
    });
  });

  return Array.from(tokens).filter(Boolean);
};

// Check if a text field matches search tokens or acronyms
const checkTextMatch = (targetText, searchTokens, rawQuery) => {
  if (!targetText || searchTokens.length === 0) return false;
  const targetLower = String(targetText).toLowerCase();
  const targetNorm = normalizeStr(targetText);
  const targetAcronym = getAcronym(targetText).toLowerCase();
  const rawQueryNorm = normalizeStr(rawQuery);

  if (targetAcronym && (searchTokens.includes(targetAcronym) || targetAcronym === rawQueryNorm)) {
    return true;
  }

  return searchTokens.some((token) => {
    const tokenLower = token.toLowerCase();
    const tokenNorm = normalizeStr(token);
    if (!tokenNorm) return false;
    return (
      targetLower.includes(tokenLower) ||
      targetNorm.includes(tokenNorm) ||
      (targetAcronym && targetAcronym.includes(tokenNorm))
    );
  });
};

// Check if tags match search tokens
const checkTagsMatch = (tags, searchTokens, rawQuery) => {
  if (!Array.isArray(tags) || tags.length === 0 || searchTokens.length === 0) return false;
  return tags.some((tag) => checkTextMatch(tag, searchTokens, rawQuery));
};

export const isJobDateExpired = (job) => {
  if (!job) return false;
  if (job.isArchived === true) return true;
  if (!job.applicationLastDate) return false;

  const str = String(job.applicationLastDate).trim();
  if (
    !str ||
    ["n/a", "none", "tentative", "to be announced", "will be announced soon"].includes(
      str.toLowerCase()
    )
  ) {
    return false;
  }

  // YYYY-MM-DD format
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    return d.getTime() < Date.now();
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(23, 59, 59, 999);
    return parsed.getTime() < Date.now();
  }

  return false;
};

export const getAllJobs = async (req, res) => {
  try {
    const { type, category, q, search, includeArchived, archivedOnly } = req.query;
    const query = { isActive: true };

    if (type && type !== "all") {
      query.type = type;
    }

    if (category && category !== "All Opportunities" && category !== "all") {
      query.category = category;
    }

    let jobs = await Job.find(query).sort({ createdAt: -1 });

    // Handle archive & expiration filtering
    if (archivedOnly === "true") {
      jobs = jobs.filter((j) => isJobDateExpired(j));
    } else if (includeArchived !== "true") {
      // For general public site queries, only return active non-expired jobs
      jobs = jobs.filter((j) => !isJobDateExpired(j));
    }

    const rawKeyword = (q || search || "").trim();
    if (rawKeyword) {
      const searchTokens = getSearchTokens(rawKeyword);

      // Priority 1: Match on Title
      const titleMatches = jobs.filter((j) =>
        checkTextMatch(j.title, searchTokens, rawKeyword)
      );

      // Priority 2: Match on Tags (if not already matched in title)
      const tagMatches = jobs.filter((j) => {
        if (titleMatches.some((m) => String(m._id) === String(j._id))) return false;
        const tags = Array.isArray(j.tags) ? j.tags : [];
        return checkTagsMatch(tags, searchTokens, rawKeyword);
      });

      // Priority 3: Match on Organization name
      const orgMatches = jobs.filter((j) => {
        if (
          titleMatches.some((m) => String(m._id) === String(j._id)) ||
          tagMatches.some((m) => String(m._id) === String(j._id))
        ) {
          return false;
        }
        return checkTextMatch(j.organization, searchTokens, rawKeyword);
      });

      // Prioritized result: Title matches first, then Tag matches, then Organization matches
      jobs = [...titleMatches, ...tagMatches, ...orgMatches];
    }

    return res.status(200).json({
      success: true,
      total: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch job postings.",
    });
  }
};

export const toggleArchiveJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }
    job.isArchived = !job.isArchived;
    await job.save();
    return res.status(200).json({
      success: true,
      message: `Job ${job.isArchived ? "archived" : "restored"} successfully.`,
      job,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createJob = async (req, res) => {
  try {
    const {
      title,
      organization,
      category,
      type,
      level,
      status,
      vacancies,
      notificationDate,
      examDate,
      salary,
      location,
      tags,
      applyUrl,
      logoUrl,
      description,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Job or Exam title is required.",
      });
    }

    if (!organization || !organization.trim()) {
      return res.status(400).json({
        success: false,
        message: "Organization or Company name is required.",
      });
    }

    // Process tags
    let processedTags = [];
    if (Array.isArray(tags)) {
      processedTags = tags.map((t) => t.trim()).filter(Boolean);
    } else if (typeof tags === "string") {
      processedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const isSSC = organization.trim().toLowerCase().includes("staff selection commission") || organization.trim().toLowerCase() === "ssc";
    const defaultBanner = isSSC ? "/SSC.png" : "/UPSC.png";
    const defaultLogo = isSSC ? "/Staff_Selection_Commission_Logo.jpg" : "";

    const newJob = await Job.create({
      title: title.trim(),
      organization: organization.trim(),
      category: category || "Government Exams",
      type: type || (category === "Private Jobs" ? "private" : "govt"),
      level: level || "National",
      status: status || "Apply Now",
      vacancies: vacancies ? String(vacancies).trim() : "",
      notificationDate: notificationDate ? String(notificationDate).trim() : "",
      examDate: examDate ? String(examDate).trim() : "",
      applicationStartDate: req.body.applicationStartDate ? String(req.body.applicationStartDate).trim() : "",
      applicationLastDate: req.body.applicationLastDate ? String(req.body.applicationLastDate).trim() : "",
      resultDate: req.body.resultDate ? String(req.body.resultDate).trim() : "",
      selectionStages: req.body.selectionStages ? String(req.body.selectionStages).trim() : "Prelims • Mains • Interview",
      slogan: req.body.slogan ? String(req.body.slogan).trim() : (isSSC ? "Opportunities for a Brighter Tomorrow" : "Serve Lead Bring Change"),
      subSlogan: req.body.subSlogan ? String(req.body.subSlogan).trim() : (isSSC ? "Same Preparation, Bigger Opportunities" : "A Stronger India Needs You"),
      aboutOrg: req.body.aboutOrg ? String(req.body.aboutOrg).trim() : "",
      bannerUrl: req.body.bannerUrl ? String(req.body.bannerUrl).trim() : defaultBanner,
      notificationPdfUrl: req.body.notificationPdfUrl ? String(req.body.notificationPdfUrl).trim() : "",
      educationalQualification: req.body.educationalQualification ? String(req.body.educationalQualification).trim() : undefined,
      ageLimitMin: req.body.ageLimitMin ? String(req.body.ageLimitMin).trim() : undefined,
      ageLimitMax: req.body.ageLimitMax ? String(req.body.ageLimitMax).trim() : undefined,
      ageLimitAsOn: req.body.ageLimitAsOn ? String(req.body.ageLimitAsOn).trim() : undefined,
      nationality: req.body.nationality ? String(req.body.nationality).trim() : undefined,
      ageRelaxation: req.body.ageRelaxation || undefined,
      numberAttempts: req.body.numberAttempts ? String(req.body.numberAttempts).trim() : "",
      otherRequirements: req.body.otherRequirements || undefined,
      importantNote: req.body.importantNote ? String(req.body.importantNote).trim() : undefined,
      participatingServices: req.body.participatingServices ? String(req.body.participatingServices).trim() : undefined,
      postsDescription: req.body.postsDescription ? String(req.body.postsDescription).trim() : undefined,
      categoryVacancies: req.body.categoryVacancies || undefined,
      serviceVacancies: req.body.serviceVacancies || undefined,
      vacancyTableType: req.body.vacancyTableType || "standard",
      rrbVacancies: req.body.rrbVacancies || [],
      examPattern: req.body.examPattern || undefined,
      applicationFee: req.body.applicationFee || undefined,
      salary: salary ? salary.trim() : "",
      location: location ? location.trim() : "All India",
      tags: processedTags,
      applyUrl: applyUrl ? applyUrl.trim() : "#",
      logoUrl: logoUrl ? logoUrl.trim() : defaultLogo,
      description: description ? description.trim() : "",
    });

    // Increment category counter if matched
    if (category) {
      await Category.findOneAndUpdate(
        { name: category },
        { $inc: { count: 1 } }
      );
    }

    // Broadcast email notification asynchronously to all registered active users
    broadcastNewJobNotification({ job: newJob }).catch((err) =>
      console.error("[Email] Error broadcasting new job notification:", err)
    );

    return res.status(201).json({
      success: true,
      message: "Job notification posted successfully!",
      job: newJob,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to post job notification.",
    });
  }
};

export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job opportunity not found.",
      });
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("Error fetching job details:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch job details.",
    });
  }
};

export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.tags) {
      if (Array.isArray(updates.tags)) {
        updates.tags = updates.tags.map((t) => t.trim()).filter(Boolean);
      } else if (typeof updates.tags === "string") {
        updates.tags = updates.tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }

    const updatedJob = await Job.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        message: "Job listing not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Job listing updated successfully!",
      job: updatedJob,
    });
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update job.",
    });
  }
};

export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndDelete(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    // Decrement category counter if applicable
    if (job.category) {
      await Category.findOneAndUpdate(
        { name: job.category },
        { $inc: { count: -1 } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Job posting removed successfully.",
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete job.",
    });
  }
};

export const notifyJobPosting = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job opportunity not found.",
      });
    }

    const result = await broadcastNewJobNotification({ job });

    if (!result.success && result.error) {
      return res.status(500).json({
        success: false,
        message: `Failed to broadcast notification: ${result.error?.message || result.error}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Email alert broadcasted to ${result.count || 0} registered user(s)!`,
      count: result.count || 0,
    });
  } catch (error) {
    console.error("Error broadcasting job email:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to broadcast email notifications.",
    });
  }
};

// ==========================================
// ORGANIZATIONS & PROVIDERS
// ==========================================

export const getAllOrganizations = async (req, res) => {
  try {
    let orgs = await Organization.find().sort({ name: 1 });

    // Seed defaults if empty
    if (!orgs || orgs.length === 0) {
      await Organization.insertMany(DEFAULT_ORGANIZATIONS);
      orgs = await Organization.find().sort({ name: 1 });
    } else {
      // Ensure key standard organizations (like SSC) exist in DB
      for (const defOrg of DEFAULT_ORGANIZATIONS) {
        const found = orgs.find((o) => o.name.toLowerCase() === defOrg.name.toLowerCase());
        if (!found) {
          await Organization.create(defOrg);
        } else if (defOrg.name === "Staff Selection Commission" && (!found.bannerUrl || found.bannerUrl === "/UPSC.png")) {
          // Keep banner & logo updated to SSC.png & Staff_Selection_Commission_Logo.jpg
          await Organization.findByIdAndUpdate(found._id, {
            bannerUrl: defOrg.bannerUrl,
            logoUrl: defOrg.logoUrl,
          });
        }
      }
      orgs = await Organization.find().sort({ name: 1 });
    }

    return res.status(200).json({
      success: true,
      organizations: orgs,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch organizations.",
    });
  }
};

export const createOrganization = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      logoUrl,
      bannerUrl,
      about,
      slogan,
      subSlogan,
      selectionStages,
      officialWebsite,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Organization name is required.",
      });
    }

    const trimmedName = name.trim();
    const existing = await Organization.findOne({ name: trimmedName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Organization '${trimmedName}' already exists.`,
      });
    }

    const newOrg = await Organization.create({
      name: trimmedName,
      code: code ? code.trim() : "",
      category: category || "Government Exams",
      logoUrl: logoUrl || "",
      bannerUrl: bannerUrl || "/UPSC.png",
      about: about || "",
      slogan: slogan || "Serve Lead Bring Change",
      subSlogan: subSlogan || "A Stronger India Needs You",
      selectionStages: selectionStages || "Prelims • Mains • Interview",
      officialWebsite: officialWebsite || "",
    });

    return res.status(201).json({
      success: true,
      message: `Organization '${trimmedName}' created successfully.`,
      organization: newOrg,
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create organization.",
    });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Organization.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Organization not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully.",
      organization: updated,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update organization.",
    });
  }
};

export const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findByIdAndDelete(id);

    if (!org) {
      return res.status(404).json({
        success: false,
        message: "Organization not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Organization '${org.name}' deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete organization.",
    });
  }
};

export const uploadLogo = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided for upload.",
      });
    }

    const cloudinaryResult = await uploadLogoToCloudinary(
      file.buffer,
      file.originalname
    );

    return res.status(200).json({
      success: true,
      message: "Logo uploaded to Cloudinary successfully!",
      url: cloudinaryResult.secure_url,
      logoUrl: cloudinaryResult.secure_url,
      public_id: cloudinaryResult.public_id,
      width: cloudinaryResult.width,
      height: cloudinaryResult.height,
    });
  } catch (error) {
    console.error("Cloudinary logo upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload logo to Cloudinary.",
    });
  }
};

export const uploadBanner = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No banner image file provided for upload.",
      });
    }

    const cloudinaryResult = await uploadBannerToCloudinary(
      file.buffer,
      file.originalname
    );

    return res.status(200).json({
      success: true,
      message: "Hero Banner uploaded to Cloudinary (1600x600) successfully!",
      url: cloudinaryResult.secure_url,
      bannerUrl: cloudinaryResult.secure_url,
      public_id: cloudinaryResult.public_id,
      width: cloudinaryResult.width,
      height: cloudinaryResult.height,
    });
  } catch (error) {
    console.error("Cloudinary banner upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload banner to Cloudinary.",
    });
  }
};

export const uploadNotificationPdf = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No PDF file provided for upload.",
      });
    }

    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed.",
      });
    }

    // Check size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: "PDF file exceeds the maximum limit of 10 MB.",
      });
    }

    const cloudinaryResult = await uploadPdfToCloudinary(
      file.buffer,
      file.originalname
    );

    return res.status(200).json({
      success: true,
      message: "Official Notification PDF uploaded successfully (Max 10MB)!",
      url: cloudinaryResult.secure_url,
      public_id: cloudinaryResult.public_id,
      bytes: cloudinaryResult.bytes,
      format: cloudinaryResult.format,
      original_filename: file.originalname,
    });
  } catch (error) {
    console.error("PDF upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload Notification PDF.",
    });
  }
};

