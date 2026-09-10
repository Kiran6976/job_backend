import { Job } from "../model/job.model.js";
import { Category } from "../model/category.model.js";
import { Organization } from "../model/organization.model.js";
import {
  uploadLogoToCloudinary,
  uploadBannerToCloudinary,
  uploadPdfToCloudinary,
} from "../utils/cloudinary.js";

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

export const getAllJobs = async (req, res) => {
  try {
    const { type, category } = req.query;
    const query = { isActive: true };

    if (type && type !== "all") {
      query.type = type;
    }

    if (category && category !== "All Opportunities" && category !== "all") {
      query.category = category;
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 });

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

