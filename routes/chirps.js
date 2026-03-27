import { Router } from "express";
import mongoose from "mongoose";
import Chirp from "../models/chirp.js";
import asyncHandler from "express-async-handler";
import { checkAuth } from "../middlewares/check-auth.js";
import { upload } from "../middlewares/multerUploader.js";
import { uploadFileToS3 } from "../middlewares/s3Upload.js";

const router = Router();

// @desc    Get paginated list of chirps
// @route   GET /api/chirps?page=1&limit=20
// @access  Private
router.route("/").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [chirps, total] = await Promise.all([
            Chirp.find({ parentId: null })
                .populate("author", "_id email userpicUrl")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            Chirp.countDocuments({ parentId: null }),
        ]);

        res.status(200).json({ page, limit, total, chirps });
    })
);

// @desc    Get a chirp by ID
// @route   GET /api/chirps/:id
// @access  Private
router.route("/:id").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid chirp ID format." });
        }

        const chirp = await Chirp.findById(req.params.id)
            .populate("author", "_id email userpicUrl")
            .exec();
        if (!chirp) return res.status(404).json({ error: "Chirp not found." });

        res.status(200).json(chirp);
    })
);

// @desc    Create a new chirp
// @route   POST /api/chirps
// @access  Private
router.route("/").post(
    checkAuth,
    upload.single("pictureUrl"),
    asyncHandler(async (req, res) => {
        const { textBody, parentId } = req.body;

        if (!textBody || textBody.trim().length === 0) {
            return res.status(400).json({ error: "Chirp text is required." });
        }
        if (textBody.length > 280) {
            return res.status(400).json({ error: "Chirp text must be 280 characters or fewer." });
        }

        if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
            return res.status(400).json({ error: "Invalid parent chirp ID." });
        }

        let pictureUrl = null;
        if (req.file) {
            pictureUrl = await uploadFileToS3("chirps", req.file.buffer, req.file.originalname, req.file.mimetype);
        }

        const chirp = await Chirp.create({
            author: req.userData.userId,
            textBody: textBody.trim(),
            parentId: parentId || null,
            pictureUrl,
        });

        const populated = await chirp.populate("author", "_id email userpicUrl");
        res.status(201).json(populated);
    })
);

// @desc    Update a chirp by ID
// @route   PATCH /api/chirps/:id
// @access  Private (owner only)
router.route("/:id").patch(
    checkAuth,
    asyncHandler(async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid chirp ID format." });
        }

        const chirp = await Chirp.findById(req.params.id);
        if (!chirp) return res.status(404).json({ error: "Chirp not found." });

        if (chirp.author.toString() !== req.userData.userId) {
            return res.status(403).json({ error: "You can only edit your own chirps." });
        }

        const updates = {};
        if (req.body.textBody !== undefined) {
            const text = req.body.textBody.trim();
            if (text.length === 0 || text.length > 280) {
                return res.status(400).json({ error: "Chirp text must be 1-280 characters." });
            }
            updates.textBody = text;
        }

        const updatedChirp = await Chirp.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate("author", "_id email userpicUrl");
        res.status(200).json(updatedChirp);
    })
);

// @desc    Delete a chirp by ID
// @route   DELETE /api/chirps/:id
// @access  Private (owner only)
router.route("/:id").delete(
    checkAuth,
    asyncHandler(async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid chirp ID format." });
        }

        const chirp = await Chirp.findById(req.params.id);
        if (!chirp) return res.status(404).json({ error: "Chirp not found." });

        if (chirp.author.toString() !== req.userData.userId) {
            return res.status(403).json({ error: "You can only delete your own chirps." });
        }

        await Chirp.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Chirp deleted.", id: req.params.id });
    })
);

export default router;
