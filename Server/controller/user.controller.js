import { User } from "../model/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// ==========================================
// REGISTER
// ==========================================
export const register = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password, role } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }

    // Optional profile photo upload to Cloudinary
    let profilePhotoUrl = "";
    if (req.file) {
      try {
        const cloudResult = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname
        );
        profilePhotoUrl = cloudResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        // Continue with default avatar if Cloudinary upload fails
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in MongoDB
    const newUser = await User.create({
      fullname: fullname.trim(),
      email: normalizedEmail,
      phoneNumber: phoneNumber ? phoneNumber.trim() : "",
      password: hashedPassword,
      role: role || "jobseeker",
      profile: {
        profilePhoto: profilePhotoUrl || undefined,
      },
    });

    const sanitizedUser = {
      _id: newUser._id,
      fullname: newUser.fullname,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
      role: newUser.role,
      profile: newUser.profile,
      createdAt: newUser.createdAt,
    };

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error occurred during registration.",
    });
  }
};

// ==========================================
// LOGIN
// ==========================================
export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Auto-provision initial Admin account if logging in with designated admin email
    if (normalizedEmail === "kiransamanta88@gmail.com") {
      let adminUser = await User.findOne({ email: normalizedEmail });
      if (!adminUser) {
        const hashedAdminPassword = await bcrypt.hash("Kiran123456?", 10);
        adminUser = await User.create({
          fullname: "Kiran Samanta",
          email: normalizedEmail,
          password: hashedAdminPassword,
          role: "admin",
          phoneNumber: "+91 9876543210",
        });
        console.log("Initial admin account created: kiransamanta88@gmail.com");
      }
    }

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    // Verify password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    // Verify role if passed
    if (role && role !== user.role) {
      return res.status(400).json({
        success: false,
        message: `Account doesn't exist with the role '${role}'.`,
      });
    }

    // Sign JWT token (1 day validity)
    const tokenData = { userId: user._id };
    const token = jwt.sign(tokenData, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    const sanitizedUser = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      profile: user.profile,
    };

    return res
      .status(200)
      .cookie("token", token, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "strict",
      })
      .json({
        success: true,
        message: `Welcome back, ${user.fullname}!`,
        token,
        user: sanitizedUser,
      });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during login.",
    });
  }
};

// ==========================================
// LOGOUT
// ==========================================
export const logout = async (req, res) => {
  try {
    return res
      .status(200)
      .cookie("token", "", { maxAge: 0 })
      .json({
        success: true,
        message: "Logged out successfully.",
      });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during logout.",
    });
  }
};

// ==========================================
// GET PROFILE (AUTHENTICATED)
// ==========================================
export const getProfile = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get Profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred fetching profile.",
    });
  }
};

// ==========================================
// UPDATE PROFILE (AUTHENTICATED)
// ==========================================
export const updateProfile = async (req, res) => {
  try {
    const {
      fullname,
      email,
      phoneNumber,
      bio,
      skills,
      headline,
      motto,
      location,
      education,
      experience,
      profilePhoto,
      bannerImage,
    } = req.body;
    const userId = req.id;

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Optional profile photo upload to Cloudinary
    if (req.file) {
      try {
        const cloudResult = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname
        );
        user.profile.profilePhoto = cloudResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary profile photo upload failed:", uploadError);
      }
    } else if (profilePhoto !== undefined) {
      user.profile.profilePhoto = profilePhoto;
    }

    if (fullname !== undefined) user.fullname = fullname.trim();
    if (email !== undefined) user.email = email.toLowerCase().trim();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
    if (bio !== undefined) user.profile.bio = bio;
    if (headline !== undefined) user.profile.headline = headline;
    if (motto !== undefined) user.profile.motto = motto;
    if (location !== undefined) user.profile.location = location;
    if (bannerImage !== undefined) user.profile.bannerImage = bannerImage;

    if (skills !== undefined) {
      const skillsArray = typeof skills === "string"
        ? skills.split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(skills) ? skills : [];
      user.profile.skills = skillsArray;
    }

    if (education !== undefined) {
      try {
        user.profile.education = typeof education === "string" ? JSON.parse(education) : education;
      } catch (e) {
        if (Array.isArray(education)) user.profile.education = education;
      }
    }

    if (experience !== undefined) {
      try {
        user.profile.experience = typeof experience === "string" ? JSON.parse(experience) : experience;
      } catch (e) {
        if (Array.isArray(experience)) user.profile.experience = experience;
      }
    }

    await user.save();

    const sanitizedUser = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      profile: user.profile,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("Update Profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred updating profile.",
    });
  }
};

// ==========================================
// GOOGLE OAUTH LOGIN / SIGNUP
// ==========================================
export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required.",
      });
    }

    // Verify token with Google
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      // Fallback verification via Google tokeninfo endpoint
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!googleRes.ok) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired Google token.",
        });
      }
      payload = await googleRes.json();
    }

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: "Unable to retrieve user information from Google.",
      });
    }

    const { email, name, sub: googleId, picture } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Create new Job Seeker user
      user = await User.create({
        fullname: name || "Google User",
        email: normalizedEmail,
        googleId: googleId || "",
        role: "jobseeker",
        profile: {
          profilePhoto: picture || "",
        },
      });
    } else {
      // If user exists without googleId, link it
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        if (picture && (!user.profile?.profilePhoto || user.profile.profilePhoto.includes("unsplash"))) {
          user.profile.profilePhoto = picture;
        }
        await user.save();
      }
    }

    // Issue JWT token
    const tokenData = { userId: user._id };
    const jwtToken = jwt.sign(tokenData, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    const sanitizedUser = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      role: user.role,
      profile: user.profile,
    };

    return res
      .status(200)
      .cookie("token", jwtToken, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "strict",
      })
      .json({
        success: true,
        message: `Welcome, ${user.fullname}!`,
        token: jwtToken,
        user: sanitizedUser,
      });
  } catch (error) {
    console.error("Google Auth error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error occurred during Google authentication.",
    });
  }
};

// ==========================================
// ADMIN: GET ALL USERS (REAL-TIME, SEARCH, FILTER, PAGINATION)
// ==========================================
export const getAllUsersAdmin = async (req, res) => {
  try {
    const {
      search = "",
      role = "all",
      provider = "all",
      status = "all",
      sortBy = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Search query across name, email, phone
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { fullname: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
      ];
    }

    // Role filter
    if (role && role !== "all") {
      query.role = role;
    }

    // Provider filter
    if (provider === "google") {
      query.googleId = { $exists: true, $ne: "" };
    } else if (provider === "local") {
      query.$or = [
        { googleId: { $exists: false } },
        { googleId: "" },
      ];
    }

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Sort order
    let sortOptions = { createdAt: -1 };
    if (sortBy === "oldest") sortOptions = { createdAt: 1 };
    else if (sortBy === "name_asc") sortOptions = { fullname: 1 };
    else if (sortBy === "name_desc") sortOptions = { fullname: -1 };

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      users,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    console.error("Get All Users Admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch users.",
    });
  }
};

// ==========================================
// ADMIN: GET USER METRICS & REAL-TIME STATS
// ==========================================
export const getUserStatsAdmin = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalJobseekers = await User.countDocuments({ role: "jobseeker" });
    const totalRecruiters = await User.countDocuments({ role: "recruiter" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalGoogleUsers = await User.countDocuments({
      googleId: { $exists: true, $ne: "" },
    });
    const totalSuspended = await User.countDocuments({ status: "suspended" });

    // Today's new signups
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({
      createdAt: { $gte: startOfToday },
    });

    // Last 7 days signups
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const newThisWeek = await User.countDocuments({
      createdAt: { $gte: startOfWeek },
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalJobseekers,
        totalRecruiters,
        totalAdmins,
        totalGoogleUsers,
        totalSuspended,
        totalActive: Math.max(0, totalUsers - totalSuspended),
        newToday,
        newThisWeek,
      },
    });
  } catch (error) {
    console.error("Get User Stats Admin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user statistics.",
    });
  }
};

// ==========================================
// ADMIN: UPDATE USER ROLE
// ==========================================
export const updateUserRoleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["jobseeker", "recruiter", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified.",
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (
      targetUser.email.toLowerCase() === "kiransamanta88@gmail.com" &&
      role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Primary super administrator account cannot be demoted.",
      });
    }

    targetUser.role = role;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `User role updated to '${role}' successfully.`,
      user: {
        _id: targetUser._id,
        fullname: targetUser.fullname,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status || "active",
      },
    });
  } catch (error) {
    console.error("Update User Role error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update user role.",
    });
  }
};

// ==========================================
// ADMIN: UPDATE USER STATUS (ACTIVE / SUSPENDED)
// ==========================================
export const updateUserStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'suspended'.",
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (targetUser.email.toLowerCase() === "kiransamanta88@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "Primary super administrator account cannot be suspended.",
      });
    }

    targetUser.status = status;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `Account status updated to '${status}'.`,
      user: {
        _id: targetUser._id,
        fullname: targetUser.fullname,
        email: targetUser.email,
        status: targetUser.status,
      },
    });
  } catch (error) {
    console.error("Update User Status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update user status.",
    });
  }
};

// ==========================================
// ADMIN: DELETE USER
// ==========================================
export const deleteUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (targetUser.email.toLowerCase() === "kiransamanta88@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "Primary super administrator account cannot be deleted.",
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `User ${targetUser.fullname} was permanently deleted.`,
    });
  } catch (error) {
    console.error("Delete User error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete user.",
    });
  }
};

