import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { auth } from "../middlewares/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        cb(null, allowed.includes(file.mimetype));
    },
});

const router = Router();

router.post("/", auth, upload.array("images", 4), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No images uploaded." });
    }
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.status(200).json({ urls });
});

export default router;
