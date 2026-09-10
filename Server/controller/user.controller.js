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
    const { fullname, email, phoneNumber, bio, skills } = req.body;
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
    }

    if (fullname) user.fullname = fullname.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phoneNumber) user.phoneNumber = phoneNumber.trim();
    if (bio) user.profile.bio = bio;

    if (skills) {
      const skillsArray = typeof skills === "string"
        ? skills.split(",").map((s) => s.trim())
        : skills;
      user.profile.skills = skillsArray;
    }

    await user.save();

    const sanitizedUser = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      profile: user.profile,
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

