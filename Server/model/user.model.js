import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      default: "",
    },
    googleId: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["jobseeker", "recruiter", "admin"],
      default: "jobseeker",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    profile: {
      bio: { type: String, default: "" },
      headline: { type: String, default: "Aspirant | Always Learning" },
      motto: { type: String, default: "Discipline today, a better tomorrow." },
      location: { type: String, default: "Kolkata, West Bengal" },
      bannerImage: { type: String, default: "/Profile_Header.png" },
      skills: [{ type: String }],
      education: [
        {
          degree: { type: String, default: "" },
          institution: { type: String, default: "" },
          year: { type: String, default: "" },
          grade: { type: String, default: "" },
        },
      ],
      experience: [
        {
          title: { type: String, default: "" },
          organization: { type: String, default: "" },
          duration: { type: String, default: "" },
          description: { type: String, default: "" },
        },
      ],
      resume: { type: String, default: "" },
      resumeOriginalName: { type: String, default: "" },
      company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
      profilePhoto: {
        type: String,
        default: "",
      },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
