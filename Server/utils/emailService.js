import { Resend } from "resend";
import { User } from "../model/user.model.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = new Resend(RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "The Workflow <notifications@theworkflow.online>";
const SITE_URL = process.env.CLIENT_URL || "https://theworkflow.online";

/**
 * Send a welcome email to the user upon successful login or registration
 * @param {Object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.name - User's full name
 * @param {string} [params.loginMethod] - "Google Account" or "Email & Password"
 */
export const sendWelcomeEmail = async ({ email, name, loginMethod = "Email & Password" }) => {
  if (!email) return;

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
  const jobUrl = `${SITE_URL}/job/${job._id}`;
  const vacanciesText = job.vacancies ? `${job.vacancies}` : "Multiple Vacancies";
  const salaryText = job.salary ? `${job.salary}` : "As per Government / Industry Norms";
  const locationText = job.location ? `${job.location}` : "All India / Multiple Locations";
  const lastDateText = job.applicationLastDate || job.notificationDate || "Check Notification";
  const qualificationText = job.educationalQualification || "Refer to detailed notification";
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
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 36px 12px;
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
      padding: 32px 28px;
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
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #93c5fd;
      margin: 0 0 6px;
      font-weight: 600;
    }
    .job-title {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px;
      line-height: 1.3;
      color: #ffffff;
    }
    .header-sub {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
      margin: 0;
    }
    .body {
      padding: 28px 24px;
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
    }
    .job-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
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
      margin: 0 0 4px;
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
    .details-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .details-table td {
      padding: 6px 0;
      vertical-align: top;
    }
    .details-table td.label {
      color: #64748b;
      font-weight: 600;
      width: 38%;
    }
    .details-table td.value {
      color: #0f172a;
      font-weight: 600;
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
          A new career opportunity matching recent notifications has just been posted on <strong>The Workflow</strong>. Check the details below and apply before the deadline!
        </p>

        <div class="job-card">
          <div class="job-card-header">
            <div class="job-card-title">${job.title}</div>
            <span class="job-card-category">${categoryText}</span>
          </div>

          <table class="details-table">
            <tr>
              <td class="label">🏢 Organization:</td>
              <td class="value">${job.organization}</td>
            </tr>
            <tr>
              <td class="label">👥 Total Vacancies:</td>
              <td class="value">${vacanciesText}</td>
            </tr>
            <tr>
              <td class="label">💰 Salary / Pay Scale:</td>
              <td class="value">${salaryText}</td>
            </tr>
            <tr>
              <td class="label">📍 Location:</td>
              <td class="value">${locationText}</td>
            </tr>
            <tr>
              <td class="label">⏳ Last Date to Apply:</td>
              <td class="value" style="color: #dc2626;">${lastDateText}</td>
            </tr>
            <tr>
              <td class="label">🎓 Qualification:</td>
              <td class="value">${qualificationText}</td>
            </tr>
            <tr>
              <td class="label">🎯 Selection Process:</td>
              <td class="value">${selectionStagesText}</td>
            </tr>
          </table>
        </div>

        <div class="cta-container">
          <a href="${jobUrl}" class="cta-button">View Details &amp; Apply Now &rarr;</a>
        </div>

        <p class="text" style="font-size: 12.5px; color: #64748b; text-align: center; margin-top: 20px;">
          Direct Application Link: <a href="${jobUrl}" style="color: #2563eb;">${jobUrl}</a>
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
    const users = await User.find({
      status: { $ne: "suspended" },
      email: { $exists: true, $ne: "" },
    })
      .select("email fullname")
      .lean();

    if (!users || users.length === 0) {
      console.log("[Resend] No active registered users found to notify.");
      return { success: true, count: 0 };
    }

    console.log(`[Resend] Broadcasting new job alert '${job.title}' to ${users.length} registered user(s)...`);

    const subject = `📢 New Job Alert: ${job.title} - ${job.organization} | The Workflow`;

    // 2. Check if batch API is available on resend instance
    if (resend.batch && typeof resend.batch.send === "function") {
      const BATCH_SIZE = 100;
      let totalSent = 0;

      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const chunk = users.slice(i, i + BATCH_SIZE);
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
          console.error(`[Resend] Batch send failed for chunk starting at index ${i}:`, batchErr?.message || batchErr);
          // Fallback to sending individually for this chunk
          for (const item of emailBatch) {
            try {
              await resend.emails.send(item);
              totalSent++;
            } catch (singleErr) {
              console.error(`[Resend] Single email failed to ${item.to}:`, singleErr?.message || singleErr);
            }
          }
        }
      }

      console.log(`[Resend] Job broadcast completed. Sent to ${totalSent}/${users.length} user(s).`);
      return { success: true, count: totalSent };
    } else {
      // Fallback if batch API is not present
      let totalSent = 0;
      // Send in concurrent chunks of 5
      const CHUNK_SIZE = 5;
      for (let i = 0; i < users.length; i += CHUNK_SIZE) {
        const chunk = users.slice(i, i + CHUNK_SIZE);
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
            } catch (err) {
              console.error(`[Resend] Failed to send job alert to ${user.email}:`, err?.message || err);
            }
          })
        );
      }

      console.log(`[Resend] Job broadcast completed. Sent to ${totalSent}/${users.length} user(s).`);
      return { success: true, count: totalSent };
    }
  } catch (error) {
    console.error("[Resend] Error in broadcastNewJobNotification:", error?.message || error);
    return { success: false, error: error?.message || error };
  }
};

