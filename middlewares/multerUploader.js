// middlewares/upload.js
import multer from "multer";
import path from "path";

// Use disk storage temporarily, or memoryStorage for buffers
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only jpg, png, and webp files are allowed"));
        }
    },
});
