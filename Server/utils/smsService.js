/**
 * MSG91 SMS & OTP Service
 * Handles phone number normalization, OTP dispatch, verification, and retries via MSG91 API v5.
 */

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || "571073A8KqLdk0SxH06aa7b442P1";
const MSG91_BASE_URL = "https://control.msg91.com/api/v5/otp";

/**
 * Format and normalize phone number into standard international format (e.g., 919876543210)
 * @param {string} phone
 * @returns {string}
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== "string") return "";
  // Strip out spaces, hyphens, brackets, and leading '+'
  let cleaned = phone.replace(/[^\d]/g, "");

  // If 10-digit Indian number, prepend 91 country code
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }

  return cleaned;
};

/**
 * Validate that phone number contains valid digits
 * @param {string} phone
 * @returns {boolean}
 */
export const isValidPhoneNumber = (phone) => {
  const normalized = normalizePhoneNumber(phone);
  // Must be between 10 and 15 digits
  return normalized.length >= 10 && normalized.length <= 15;
};

/**
 * Send an OTP via MSG91 SMS service
 * @param {Object} params
 * @param {string} params.phoneNumber - Recipient phone number
 * @param {string} [params.otp] - Optional custom 6-digit OTP
 * @param {string} [params.templateId] - Optional MSG91 Template ID
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
export const sendSmsOtp = async ({ phoneNumber, otp, templateId }) => {
  const mobile = normalizePhoneNumber(phoneNumber);

  if (!mobile || !isValidPhoneNumber(phoneNumber)) {
    return {
      success: false,
      message: "Please enter a valid phone number with country code.",
    };
  }

  try {
    const authKey = process.env.MSG91_AUTH_KEY || MSG91_AUTH_KEY;
    const url = new URL(MSG91_BASE_URL);
    url.searchParams.append("mobile", mobile);
    url.searchParams.append("otp_expiry", "10"); // 10 minutes expiry
    url.searchParams.append("otp_length", "6");
    if (otp) {
      url.searchParams.append("otp", otp);
    }
    const activeTemplateId = templateId || process.env.MSG91_OTP_TEMPLATE_ID;
    if (activeTemplateId) {
      url.searchParams.append("template_id", activeTemplateId);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data && (data.type === "success" || data.message === "OTP sent success" || data.type !== "error")) {
      console.log(`[MSG91] SMS OTP sent successfully to ${mobile}`);
      return { success: true, message: "OTP sent successfully to your phone.", data };
    }

    // Handle MSG91 error payload
    const errMsg = data?.message || "Failed to send SMS OTP via MSG91.";
    console.warn(`[MSG91] Send OTP error for ${mobile}:`, errMsg);
    return { success: false, message: errMsg, data };
  } catch (error) {
    console.error(`[MSG91] Exception sending SMS OTP to ${mobile}:`, error?.message || error);
    return {
      success: false,
      message: error?.message || "Error connecting to SMS service.",
    };
  }
};

/**
 * Verify an entered OTP with MSG91
 * @param {Object} params
 * @param {string} params.phoneNumber - Phone number
 * @param {string} params.otp - 6-digit OTP to verify
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const verifySmsOtp = async ({ phoneNumber, otp }) => {
  const mobile = normalizePhoneNumber(phoneNumber);

  if (!mobile || !otp) {
    return { success: false, message: "Phone number and OTP are required." };
  }

  try {
    const authKey = process.env.MSG91_AUTH_KEY || MSG91_AUTH_KEY;
    const url = `${MSG91_BASE_URL}/verify?otp=${encodeURIComponent(otp.trim())}&mobile=${encodeURIComponent(mobile)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        authkey: authKey,
      },
    });

    const data = await response.json().catch(() => null);

    if (
      response.ok &&
      data &&
      (data.type === "success" || data.message === "OTP verified success" || data.message === "Mobile no. already verified")
    ) {
      console.log(`[MSG91] OTP verified successfully for ${mobile}`);
      return { success: true, message: "Phone number verified successfully." };
    }

    const errMsg = data?.message || "Invalid or expired OTP.";
    return { success: false, message: errMsg };
  } catch (error) {
    console.error(`[MSG91] Exception verifying OTP for ${mobile}:`, error?.message || error);
    return {
      success: false,
      message: error?.message || "Error verifying OTP.",
    };
  }
};

/**
 * Resend OTP via SMS or Voice Call with MSG91
 * @param {Object} params
 * @param {string} params.phoneNumber - Phone number
 * @param {string} [params.retryType] - "text" (default) or "voice"
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const resendSmsOtp = async ({ phoneNumber, retryType = "text" }) => {
  const mobile = normalizePhoneNumber(phoneNumber);

  if (!mobile) {
    return { success: false, message: "Valid phone number is required." };
  }

  try {
    const authKey = process.env.MSG91_AUTH_KEY || MSG91_AUTH_KEY;
    const url = `${MSG91_BASE_URL}/retry?authkey=${encodeURIComponent(authKey)}&mobile=${encodeURIComponent(mobile)}&retrytype=${encodeURIComponent(retryType)}`;

    const response = await fetch(url, {
      method: "GET",
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data && (data.type === "success" || data.message === "OTP resent success")) {
      console.log(`[MSG91] OTP resent successfully to ${mobile}`);
      return { success: true, message: "OTP has been resent to your mobile number." };
    }

    const errMsg = data?.message || "Failed to resend OTP.";
    return { success: false, message: errMsg };
  } catch (error) {
    console.error(`[MSG91] Exception resending OTP to ${mobile}:`, error?.message || error);
    return {
      success: false,
      message: error?.message || "Error resending OTP.",
    };
  }
};
