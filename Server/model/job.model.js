import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job/Exam title is required"],
      trim: true,
    },
    organization: {
      type: String,
      required: [true, "Organization or company name is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      default: "Government Exams",
    },
    type: {
      type: String,
      enum: ["govt", "private", "internship", "other"],
      default: "govt",
    },
    level: {
      type: String,
      default: "National", // "National", "State", "Global", "Remote"
    },
    status: {
      type: String,
      default: "Apply Now", // "Apply Now", "Apply Soon", "Ongoing", "Upcoming", "Active"
    },
    vacancies: {
      type: String,
      default: "", // e.g. "1,056 Vacancies"
    },
    notificationDate: {
      type: String,
      default: "", // e.g. "Feb 2025"
    },
    examDate: {
      type: String,
      default: "", // e.g. "May 2025"
    },
    salary: {
      type: String,
      default: "", // e.g. "₹12 - 18 LPA"
    },
    location: {
      type: String,
      default: "All India", // e.g. "Bangalore / Remote"
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    applyUrl: {
      type: String,
      default: "",
    },
    logoUrl: {
      type: String,
      default: "", // Official emblem or company logo
    },
    bannerUrl: {
      type: String,
      default: "/UPSC.png",
    },
    aboutOrg: {
      type: String,
      default: "",
    },
    slogan: {
      type: String,
      default: "Serve Lead Bring Change",
    },
    subSlogan: {
      type: String,
      default: "A Stronger India Needs You",
    },
    selectionStages: {
      type: String,
      default: "Prelims • Mains • Interview",
    },
    applicationStartDate: {
      type: String,
      default: "", // e.g. "1 Feb 2025" or "2025-02-01"
    },
    applicationLastDate: {
      type: String,
      default: "", // e.g. "20 Feb 2025" or "2025-02-20"
    },
    resultDate: {
      type: String,
      default: "", // e.g. "July 2025"
    },
    notificationPdfUrl: {
      type: String,
      default: "",
    },
    // Eligibility Criteria & Requirements
    educationalQualification: {
      type: String,
      default: "A Bachelor's Degree from a recognized University or equivalent.",
    },
    ageLimitMin: {
      type: String,
      default: "21",
    },
    ageLimitMax: {
      type: String,
      default: "32",
    },
    ageLimitAsOn: {
      type: String,
      default: "01 Aug 2025",
    },
    nationality: {
      type: String,
      default: "Must be a citizen of India. Tibetan refugees and certain other categories are also eligible as per rules.",
    },
    ageRelaxation: {
      scSt: { type: String, default: "5 years" },
      obc: { type: String, default: "3 years" },
      pwbd: { type: String, default: "10 years" },
      exServicemen: { type: String, default: "As per rules" },
    },
    numberAttempts: {
      type: String,
      default: "",
    },
    // Vacancy Details & Distribution
    participatingServices: {
      type: String,
      default: "24",
    },
    postsDescription: {
      type: String,
      default: "Multiple",
    },
    categoryVacancies: {
      type: mongoose.Schema.Types.Mixed,
      default: { ur: 430, obc: 281, sc: 175, st: 170 },
    },
    serviceVacancies: {
      type: [mongoose.Schema.Types.Mixed],
      default: [
        { sNo: 1, service: "Indian Administrative Service (IAS)", ur: 73, obc: 42, sc: 28, st: 17, total: 160 },
        { sNo: 2, service: "Indian Police Service (IPS)", ur: 60, obc: 38, sc: 27, st: 15, total: 140 },
        { sNo: 3, service: "Indian Foreign Service (IFS)", ur: 34, obc: 22, sc: 16, st: 8, total: 80 },
        { sNo: 4, service: "Indian Revenue Service (IRS)", ur: 55, obc: 36, sc: 24, st: 15, total: 130 },
        { sNo: 5, service: "Indian Audit & Accounts Service (IA&AS)", ur: 28, obc: 18, sc: 12, st: 7, total: 65 },
      ],
    },
    // Section 4 (RRB Mode): Regional RRBs Post Distribution
    vacancyTableType: {
      type: String,
      enum: ["standard", "rrb"],
      default: "standard",
    },
    rrbVacancies: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Section 5: Exam Pattern & Structure
    examPattern: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    otherRequirements: {
      type: [String],
      default: [
        "Must be of good moral character",
        "Meet physical and medical standards (as applicable)",
        "No criminal record",
        "Should not be debarred from any government examination",
      ],
    },
    importantNote: {
      type: String,
      default: "The eligibility criteria mentioned above is a summary. Candidates must read the official notification carefully for complete and accurate details. In case of any discrepancy, the official notification issued by UPSC shall be final.",
    },
    // Application Fee Structure
    applicationFee: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    description: {
      type: String,
      default: "",
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Job = mongoose.model("Job", jobSchema);
