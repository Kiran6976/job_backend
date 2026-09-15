import { Resend } from "resend";
import { User } from "../model/user.model.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = new Resend(RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "The Workflow <notifications@theworkflow.online>";

const getSiteUrl = () => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, "");

  if (process.env.CLIENT_URL) {
    const urls = process.env.CLIENT_URL.split(",").map((u) => u.trim());
    // Prioritize the official custom domain first
    const customDomain = urls.find((u) => u.includes("theworkflow.online") && !u.includes("localhost"));
    if (customDomain) return customDomain.replace(/\/+$/, "");

    const prodUrl = urls.find(
      (u) =>
        (u.includes("vercel.app") || u.startsWith("https://")) &&
        !u.includes("localhost")
    );
    if (prodUrl) return prodUrl.replace(/\/+$/, "");
  }

  return "https://www.theworkflow.online";
};

const SITE_URL = getSiteUrl();

const formatEmailDate = (dateStr, fallback = "Check Notification") => {
  if (!dateStr) return fallback;
  try {
    if (dateStr.includes("-") && dateStr.length >= 10) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        }
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.org",
  "test.net",
  "dummy.com",
  "sample.com",
  "fake.com",
  "invalid.com",
  "localhost",
  "none.com",
  "mailinator.com",
  "tempmail.com",
]);

/**
 * Validate that an email address is properly formatted and does not use fake/test domains
 * @param {string} email
 * @returns {boolean}
 */
export const isValidRecipientEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();

  // Basic regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];

  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (domain.endsWith(".example") || domain.endsWith(".test") || domain.endsWith(".local") || domain.endsWith(".invalid")) {
    return false;
  }

  return true;
};

/**
 * Send a welcome email to the user upon successful login or registration
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.name - User's full name
 * @param {string} [params.loginMethod] - "Google Account" or "Email & Password"
 */
export const sendWelcomeEmail = async ({ email, name, loginMethod = "Email & Password" }) => {
  if (!isValidRecipientEmail(email)) {
    console.log(`[Resend] Skipping welcome email for invalid/test address: ${email}`);
    return { success: false, message: "Invalid email" };
  }

  const displayName = name || "there";
  const firstName = displayName.split(" ")[0] || "there";

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to The Workflow — Your Career Journey Starts Here</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
    }
    .preview-text {
      display: none;
      max-height: 0px;
      overflow: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      color: #ffffff;
      opacity: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 36px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 26px;
      font-weight: 800;
      margin: 0 0 8px;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .header-sub {
      font-size: 14.5px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
      line-height: 1.4;
    }
    .body {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 14px;
    }
    .text {
      font-size: 15px;
      color: #475569;
      margin: 0 0 16px;
      line-height: 1.65;
    }
    .section-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 28px 0 16px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .features-list {
      margin: 0 0 28px;
      padding: 0;
      list-style: none;
    }
    .feature-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: flex-start;
    }
    .feature-icon {
      font-size: 22px;
      margin-right: 14px;
      line-height: 1.2;
      flex-shrink: 0;
    }
    .feature-content {
      font-size: 14px;
      color: #334155;
      line-height: 1.55;
    }
    .feature-name {
      font-weight: 700;
      color: #0f172a;
      display: block;
      margin-bottom: 3px;
    }
    .cta-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
    }
    .cta-box-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px;
    }
    .cta-box-sub {
      font-size: 14px;
      color: #475569;
      margin: 0 0 18px;
    }
    .cta-btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 13px 32px;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    .signoff {
      font-size: 14.5px;
      color: #334155;
      margin: 24px 0 0;
      line-height: 1.6;
    }
    .signoff-tagline {
      font-weight: 700;
      color: #0f172a;
      margin: 8px 0;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer-links a {
      color: #64748b;
      text-decoration: none;
      margin: 0 8px;
    }
    @media only screen and (max-width: 520px) {
      .wrapper { padding: 12px 6px !important; }
      .container { width: 100% !important; border-radius: 12px !important; }
      .header { padding: 24px 18px !important; }
      .body { padding: 20px 16px !important; }
      .cta-btn { width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body>
  <div class="preview-text">
    Your account is ready. Discover opportunities, stay updated, and take the next step toward your career goals.
  </div>

  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-badge">The Workflow</div>
        <h1 class="header-title">Welcome to The Workflow 👋</h1>
        <p class="header-sub">Your next opportunity could be closer than you think.</p>
      </div>

      <div class="body">
        <h2 class="greeting">Hi ${firstName},</h2>
        <p class="text">
          Welcome to <strong>The Workflow</strong> — your dedicated platform for discovering and staying on top of government jobs, competitive exams, and career opportunities.
        </p>
        <p class="text">
          Your account has been successfully created, and you're now ready to explore everything The Workflow has to offer.
        </p>

        <h3 class="section-title">Everything you need, in one place.</h3>

        <div class="features-list">
          <div class="feature-card">
            <span class="feature-icon">🏛️</span>
            <div class="feature-content">
              <span class="feature-name">Discover Career Opportunities</span>
              Explore the latest opportunities from UPSC, SSC, Railways (RRB), Banking (IBPS), Defence, Teaching, and more.
            </div>
          </div>

          <div class="feature-card">
            <span class="feature-icon">📄</span>
            <div class="feature-content">
              <span class="feature-name">Access Exam Information</span>
              Get clear, organized information about exam patterns, eligibility criteria, vacancies, important dates, and official notifications.
            </div>
          </div>

          <div class="feature-card">
            <span class="feature-icon">🔔</span>
            <div class="feature-content">
              <span class="feature-name">Stay Ahead of Deadlines</span>
              Receive timely updates about application deadlines, exam dates, admit cards, results, and other important announcements.
            </div>
          </div>

          <div class="feature-card">
            <span class="feature-icon">📚</span>
            <div class="feature-content">
              <span class="feature-name">Prepare with Confidence</span>
              Find the information you need to understand each opportunity and make better decisions about your career path.
            </div>
          </div>
        </div>

        <div class="cta-box">
          <div class="cta-box-title">Ready to explore?</div>
          <p class="cta-box-sub">Your journey starts now. Discover opportunities that match your ambitions and stay informed every step of the way.</p>
          <a href="${SITE_URL}/jobs" class="cta-btn">Explore Opportunities &rarr;</a>
        </div>

        <div class="signoff">
          <p style="margin: 0 0 6px; font-weight: 600; color: #1e293b;">One platform. Every opportunity. Your next step.</p>
          <p style="margin: 0 0 6px;">We're excited to have you with us.</p>
          <p class="signoff-tagline">Welcome to The Workflow. Your career, your opportunities, your workflow.</p>
          <p style="margin: 12px 0 0; color: #64748b;">— Team The Workflow</p>
        </div>
      </div>

      <div class="footer">
        <p style="margin: 0 0 8px;">&copy; ${new Date().getFullYear()} The Workflow. All rights reserved.</p>
        <div class="footer-links">
          <a href="${SITE_URL}">Home</a> &bull;
          <a href="${SITE_URL}/jobs">Browse Jobs</a> &bull;
          <a href="${SITE_URL}/profile">My Profile</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Welcome to The Workflow — Your Career Journey Starts Here 🚀`,
      html: emailHtml,
    });
    console.log(`[Resend] Welcome email sent to ${email} (ID: ${data?.data?.id || data?.id || "OK"})`);
    return { success: true, data };
  } catch (error) {
    console.error(`[Resend] Failed to send welcome email to ${email}:`, error?.message || error);
    return { success: false, error };
  }
};

/**
 * Generate responsive HTML email for a new job posting alert
 * @param {Object} params
 * @param {Object} params.job - Job object
 * @param {string} [params.recipientName] - Recipient's name
 */
const generateNewJobEmailHtml = ({ job, recipientName = "Aspirant" }) => {
  const firstName = (recipientName || "Aspirant").split(" ")[0];
  const jobUrl = `${getSiteUrl()}/job/${job._id}`;
  const vacanciesText = job.vacancies ? `${job.vacancies}` : "Multiple Vacancies";
  const salaryText = job.salary ? `${job.salary}` : "As per Government / Industry Norms";
  const locationText = job.location ? `${job.location}` : "All India / Multiple Locations";
  const lastDateRaw = job.applicationLastDate || job.notificationDate;
  const lastDateText = formatEmailDate(lastDateRaw, "Check Notification");
  const qualificationText = job.educationalQualification || "Refer to detailed official notification";
  const categoryText = job.category || "Government Exams";
  const selectionStagesText = job.selectionStages || "As per official notification";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Job Alert: ${job.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      -webkit-text-size-adjust: 100%;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 32px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background: #38bdf8;
      color: #0f172a;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 4px 14px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .org-title {
      font-size: 13.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #93c5fd;
      margin: 0 0 6px;
      font-weight: 600;
    }
    .job-title {
      font-size: 21px;
      font-weight: 800;
      margin: 0 0 8px;
      line-height: 1.35;
      color: #ffffff;
      word-break: break-word;
    }
    .header-sub {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
      margin: 0;
    }
    .body {
      padding: 28px 24px;
      box-sizing: border-box;
    }
    .greeting {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
    }
    .text {
      font-size: 14.5px;
      color: #475569;
      margin: 0 0 20px;
      line-height: 1.6;
    }
    .job-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 16px;
      margin-bottom: 24px;
      box-sizing: border-box;
      width: 100%;
    }
    .job-card-header {
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .job-card-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 6px;
      line-height: 1.35;
      word-break: break-word;
    }
    .job-card-category {
      display: inline-block;
      background-color: #dbeafe;
      color: #1e40af;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .info-list {
      width: 100%;
      box-sizing: border-box;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13.5px;
      box-sizing: border-box;
    }
    .info-row-label {
      color: #64748b;
      font-weight: 600;
      font-size: 13px;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .info-row-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .info-block {
      display: block;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      box-sizing: border-box;
    }
    .info-block:last-child {
      border-bottom: none;
    }
    .info-block-label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
    }
    .info-block-value {
      display: block;
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
      line-height: 1.55;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      box-sizing: border-box;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0 16px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 13px 36px;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
      text-align: center;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer-links a {
      color: #64748b;
      text-decoration: none;
      margin: 0 8px;
    }
    @media only screen and (max-width: 520px) {
      .wrapper { padding: 10px 6px !important; }
      .container { width: 100% !important; border-radius: 12px !important; }
      .header { padding: 22px 16px !important; }
      .job-title { font-size: 18px !important; }
      .body { padding: 18px 14px !important; }
      .job-card { padding: 14px 12px !important; }
      .info-row { flex-direction: column !important; align-items: flex-start !important; gap: 2px !important; padding: 6px 0 !important; }
      .info-row-label { font-size: 12px !important; }
      .info-row-value { text-align: left !important; font-size: 13.5px !important; }
      .cta-button { width: 100% !important; box-sizing: border-box !important; padding: 12px 16px !important; font-size: 14px !important; }
      .direct-link { word-break: break-all !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="badge">🔥 New Opportunity Live</span>
        <div class="org-title">${job.organization}</div>
        <h1 class="job-title">${job.title}</h1>
        <p class="header-sub">Category: ${categoryText} &bull; Level: ${job.level || "National"}</p>
      </div>

      <div class="body">
        <h2 class="greeting">Hi ${firstName},</h2>
        <p class="text">
          A new career opportunity has just been announced on <strong>The Workflow</strong>. Check the details below and apply before the deadline!
        </p>

        <div class="job-card">
          <div class="job-card-header">
            <div class="job-card-title">${job.title}</div>
            <span class="job-card-category">${categoryText}</span>
          </div>

          <div class="info-list">
            <div class="info-row">
              <span class="info-row-label">🏢 Organization:</span>
              <span class="info-row-value">${job.organization}</span>
            </div>
            <div class="info-row">
              <span class="info-row-label">👥 Total Vacancies:</span>
              <span class="info-row-value">${vacanciesText}</span>
            </div>
            <div class="info-row">
              <span class="info-row-label">💰 Salary / Pay Scale:</span>
              <span class="info-row-value">${salaryText}</span>
            </div>
            <div class="info-row">
              <span class="info-row-label">📍 Location:</span>
              <span class="info-row-value">${locationText}</span>
            </div>
            <div class="info-row">
              <span class="info-row-label">⏳ Last Date to Apply:</span>
              <span class="info-row-value" style="color: #dc2626;">${lastDateText}</span>
            </div>
            <div class="info-block">
              <span class="info-block-label">🎓 Educational Qualification:</span>
              <div class="info-block-value">${qualificationText}</div>
            </div>
            <div class="info-block">
              <span class="info-block-label">🎯 Selection Process:</span>
              <div class="info-block-value">${selectionStagesText}</div>
            </div>
          </div>
        </div>

        <div class="cta-container">
          <a href="${jobUrl}" class="cta-button">View Details &amp; Apply Now &rarr;</a>
        </div>

        <p class="text" style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px;">
          Direct Application Link:<br />
          <a href="${jobUrl}" class="direct-link" style="color: #2563eb; word-break: break-all;">${jobUrl}</a>
        </p>
      </div>

      <div class="footer">
        <p style="margin: 0 0 8px;">&copy; ${new Date().getFullYear()} The Workflow. You are receiving this email because you are registered on The Workflow.</p>
        <div class="footer-links">
          <a href="${SITE_URL}">Home</a> &bull;
          <a href="${SITE_URL}/jobs">All Jobs</a> &bull;
          <a href="${SITE_URL}/profile">My Profile</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
};

/**
 * Broadcast an email notification to all registered users when a new job is posted
 * @param {Object} params
 * @param {Object} params.job - Newly created Job document
 */
export const broadcastNewJobNotification = async ({ job }) => {
  if (!job || !job.title) {
    console.warn("[Resend] Cannot broadcast job notification: Invalid job data.");
    return { success: false, message: "Invalid job data" };
  }

  try {
    // 1. Fetch all registered and active users
    const rawUsers = await User.find({
      status: { $ne: "suspended" },
      email: { $exists: true, $ne: "" },
    })
      .select("email fullname")
      .lean();

    if (!rawUsers || rawUsers.length === 0) {
      console.log("[Resend] No active registered users found to notify.");
      return { success: true, count: 0 };
    }

    // 2. Deduplicate and filter only valid recipient emails
    const seenEmails = new Set();
    const validUsers = [];

    for (const u of rawUsers) {
      if (u.email && isValidRecipientEmail(u.email)) {
        const normalized = u.email.trim().toLowerCase();
        if (!seenEmails.has(normalized)) {
          seenEmails.add(normalized);
          validUsers.push({
            email: normalized,
            fullname: u.fullname || "Aspirant",
          });
        }
      } else {
        console.log(`[Resend] Skipping test/invalid email: ${u.email}`);
      }
    }

    if (validUsers.length === 0) {
      console.log("[Resend] No valid recipient email addresses found after filtering test/dummy accounts.");
      return { success: true, count: 0 };
    }

    console.log(`[Resend] Broadcasting new job alert '${job.title}' to ${validUsers.length} valid registered user(s)...`);

    const subject = `📢 New Job Alert: ${job.title} - ${job.organization} | The Workflow`;
    let totalSent = 0;

    // 3. Batch send with Resend Batch API if available
    if (resend.batch && typeof resend.batch.send === "function") {
      const BATCH_SIZE = 50;

      for (let i = 0; i < validUsers.length; i += BATCH_SIZE) {
        const chunk = validUsers.slice(i, i + BATCH_SIZE);
        const emailBatch = chunk.map((user) => ({
          from: FROM_EMAIL,
          to: [user.email],
          subject,
          html: generateNewJobEmailHtml({ job, recipientName: user.fullname }),
        }));

        try {
          const result = await resend.batch.send(emailBatch);
          totalSent += emailBatch.length;
          console.log(`[Resend] Successfully sent batch ${Math.floor(i / BATCH_SIZE) + 1} (${emailBatch.length} emails).`);
        } catch (batchErr) {
          console.error(`[Resend] Batch send failed for chunk:`, batchErr?.message || batchErr);
          // Fallback to sending individually for this chunk
          for (const item of emailBatch) {
            try {
              await resend.emails.send(item);
              totalSent++;
              console.log(`[Resend] Sent fallback single email to ${item.to}`);
            } catch (singleErr) {
              console.error(`[Resend] Single email failed to ${item.to}:`, singleErr?.message || singleErr);
            }
          }
        }
      }
    } else {
      // 4. Send individually in chunks of 5
      const CHUNK_SIZE = 5;
      for (let i = 0; i < validUsers.length; i += CHUNK_SIZE) {
        const chunk = validUsers.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(
          chunk.map(async (user) => {
            try {
              await resend.emails.send({
                from: FROM_EMAIL,
                to: [user.email],
                subject,
                html: generateNewJobEmailHtml({ job, recipientName: user.fullname }),
              });
              totalSent++;
              console.log(`[Resend] Sent email to ${user.email}`);
            } catch (err) {
              console.error(`[Resend] Failed to send job alert to ${user.email}:`, err?.message || err);
            }
          })
        );
      }
    }

    console.log(`[Resend] Job broadcast finished. Successfully sent to ${totalSent}/${validUsers.length} user(s).`);
    return { success: true, count: totalSent };
  } catch (error) {
    console.error("[Resend] Error in broadcastNewJobNotification:", error?.message || error);
    return { success: false, error: error?.message || error };
  }
};

/**
 * Send an OTP verification email for account registration
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.otp - 6-digit verification code
 * @param {string} [params.name] - User full name
 */
export const sendOtpEmail = async ({ email, otp, name = "Aspirant" }) => {
  if (!isValidRecipientEmail(email)) {
    console.log(`[Resend] Skipping OTP email for invalid/test address: ${email}`);
    return { success: false, message: "Invalid email" };
  }

  const displayName = name ? name.split(" ")[0] : "there";

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code - The Workflow</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 36px 12px;
      box-sizing: border-box;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%);
      padding: 32px 28px;
      text-align: center;
      color: #ffffff;
    }
    .header-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 6px;
      color: #ffffff;
    }
    .header-sub {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }
    .body {
      padding: 32px 28px;
      text-align: center;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
      text-align: left;
    }
    .text {
      font-size: 14.5px;
      color: #475569;
      margin: 0 0 24px;
      line-height: 1.6;
      text-align: left;
    }
    .otp-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%);
      border: 2px dashed #93c5fd;
      border-radius: 14px;
      padding: 24px 16px;
      margin: 20px 0 24px;
      text-align: center;
    }
    .otp-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #3b82f6;
      margin-bottom: 8px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #1e3a8a;
      padding: 6px 0;
      user-select: all;
    }
    .otp-hint {
      font-size: 12.5px;
      color: #64748b;
      margin-top: 6px;
    }
    .expiry-note {
      display: inline-flex;
      align-items: center;
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .security-notice {
      border-top: 1px solid #f1f5f9;
      padding-top: 20px;
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.5;
      text-align: left;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-badge">The Workflow</div>
        <h1 class="header-title">Verify Your Email</h1>
        <p class="header-sub">Complete your account registration</p>
      </div>

      <div class="body">
        <h2 class="greeting">Hello ${displayName},</h2>
        <p class="text">
          Thank you for signing up on <strong>The Workflow</strong>. To complete your registration and verify your email address, please use the 6-digit verification code below:
        </p>

        <div class="otp-card">
          <div class="otp-label">Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="otp-hint">Enter this code in the verification screen to proceed</div>
        </div>

        <div class="expiry-note">
          ⏱️ This code is valid for <strong>10 minutes</strong>.
        </div>

        <div class="security-notice">
          <strong>Security Tip:</strong> Never share this verification code with anyone. The Workflow team will never ask for your verification code or password. If you did not initiate this request, you can safely ignore this email.
        </div>
      </div>

      <div class="footer">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} The Workflow. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const data = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `${otp} is your verification code - The Workflow`,
      html: emailHtml,
    });
    console.log(`[Resend] OTP email sent to ${email} (ID: ${data?.data?.id || data?.id || "OK"})`);
    return { success: true, data };
  } catch (error) {
    console.error(`[Resend] Failed to send OTP email to ${email}:`, error?.message || error);
    return { success: false, error };
  }
};


