import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      trim: true, // e.g., "UPSC", "RRB", "SSC", "IBPS"
    },
    category: {
      type: String,
      required: [true, "Category folder is required"],
      default: "Government Exams",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    bannerUrl: {
      type: String,
      default: "/UPSC.png",
    },
    about: {
      type: String,
      default:
        "Join the prestigious services and be a part of nation building. Serve the country and create a meaningful impact through policy making, governance and public welfare.",
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
    officialWebsite: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const Organization = mongoose.model("Organization", organizationSchema);
