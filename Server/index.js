import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db/connection.js";
import userRoute from "./route/user.route.js";
import jobRoute from "./route/job.route.js";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(",").forEach((url) => {
    const trimmed = url.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in production for flexibility or callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
};
app.use(cors(corsOptions));


// Health check route
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "JobPortal API is live and running!",
  });
});

// API Routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/job", jobRoute);

const PORT = process.env.PORT || 8000;

app.listen(PORT, async () => {
  await connectDB();
  console.log(`🚀 JobPortal Server is running on port ${PORT}`);
});
