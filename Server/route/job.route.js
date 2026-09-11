import express from "express";
import {
  getAllCategories,
  createCategory,
  deleteCategory,
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  toggleArchiveJob,
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  uploadLogo,
  uploadBanner,
  uploadNotificationPdf,
  notifyJobPosting,
} from "../controller/job.controller.js";
import { parsePdfWithAI } from "../controller/pdfParser.controller.js";
import { singleUpload, pdfUpload } from "../middleware/multer.js";

const router = express.Router();

// Upload to Cloudinary with fixed dimensions
router.route("/upload-logo").post(singleUpload, uploadLogo);
router.route("/upload-banner").post(singleUpload, uploadBanner);
router.route("/upload-pdf").post(pdfUpload, uploadNotificationPdf);

// AI-powered PDF notification parser → Cloudinary upload + Gemini extraction
router.route("/parse-pdf-ai").post(pdfUpload, parsePdfWithAI);

// Categories
router.route("/category/all").get(getAllCategories);
router.route("/category/create").post(createCategory);
router.route("/category/:id").delete(deleteCategory);

// Organizations / Job Providers
router.route("/organization/all").get(getAllOrganizations);
router.route("/organization/create").post(createOrganization);
router.route("/organization/:id").put(updateOrganization).delete(deleteOrganization);

// Job Postings
router.route("/all").get(getAllJobs);
router.route("/detail/:id").get(getJobById);
router.route("/create").post(createJob);
router.route("/notify/:id").post(notifyJobPosting);
router.route("/:id/notify").post(notifyJobPosting);
router.route("/archive/:id").post(toggleArchiveJob);
router.route("/:id/archive").post(toggleArchiveJob);
router.route("/:id").put(updateJob).delete(deleteJob);

export default router;

