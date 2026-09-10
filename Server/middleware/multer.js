import multer from "multer";

const storage = multer.memoryStorage();

// Middleware that accepts file under any field name ("file", "logo", "banner", etc.)
export const singleUpload = (req, res, next) => {
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max for images
  }).any();

  upload(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

export const pdfUpload = (req, res, next) => {
  const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
    fileFilter: (req, file, cb) => {
      if (
        file.mimetype === "application/pdf" ||
        (file.originalname && file.originalname.toLowerCase().endsWith(".pdf"))
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files are allowed!"), false);
      }
    },
  }).any();

  upload(req, res, (err) => {
    if (err) {
      console.error("Multer PDF upload error:", err);
      return res.status(400).json({ success: false, message: err.message });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};
