import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { auth } from "../middlewares/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");
const avatarsDir = path.join(uploadDir, "avatars");
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const memoryStorage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        cb(null, allowed.includes(file.mimetype));
    },
});

const avatarUpload = multer({
    storage: memoryStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        cb(null, allowed.includes(file.mimetype));
    },
});

const router = Router();

// General image upload (chirp media)
router.post("/", auth, upload.array("images", 4), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No images uploaded." });
    }
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.status(200).json({ urls });
});

// Avatar upload — resizes to 400x400 webp, overwrites avatars/{userId}.webp
router.post("/avatar", auth, avatarUpload.single("avatar"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image uploaded." });
    }
    try {
        const filename = `${req.user.userId}.webp`;
        const outputPath = path.join(avatarsDir, filename);

        await sharp(req.file.buffer)
            .resize(400, 400, { fit: "cover" })
            .webp({ quality: 80 })
            .toFile(outputPath);

        const url = `/uploads/avatars/${filename}`;
        res.status(200).json({ url });
    } catch (err) {
        console.error("Avatar processing error:", err);
        res.status(500).json({ error: "Failed to process avatar." });
    }
});

export default router;
