import { Router } from "express";
import bcrypt from "bcrypt";
import Chirp from "../models/chirp.js";
import asyncHandler from "express-async-handler";
import { checkAuth } from "../middlewares/check-auth.js";
import { upload } from "../middlewares/multerUploader.js";
import { uploadFileToS3 } from "../middlewares/s3Upload.js";

const router = Router();

// @desc    Get and return the full list of chirps
// @route   GET /api/chirps
// @access  Public
router.route("/").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const chirps = await Chirp.find().populate("author").exec();
            res.status(200).send(chirps);
        } catch (err) {
            console.error("Error fetching chirps:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Get and return the chirp with the specific ID
// @route   GET /api/chirps:ID
// @access  Public
router.route("/:id").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const chirp = await Chirp.findById(req.params.id).populate("author", "_id email").exec();
            if (!chirp) return res.status(404).send(`Chirp, with ID: ${req.params.id}, doesn't exists.`);

            res.status(200).send(chirp);
        } catch (err) {
            console.error("Error fetching chirp:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Creates and return the new chirp document
// @route   POST /api/chirps
// @access  Public
router.route("/").post(
    checkAuth,
    upload.single("pictureUrl"),
    asyncHandler(async (req, res) => {
        try {
            let pictureUrl = null;

            if (req.file) {
                pictureUrl = await uploadFileToS3("chirps", req.file.buffer, req.file.originalname, req.file.mimetype);
            }
            const data = {
                author: req.body.author,
                textBody: req.body.textBody,
                likesCount: req.body.likesCount,
                dislikesCount: req.body.dislikesCount,
                isPosted: req.body.isPosted,
                pictureUrl,
            };
            const chirp = await Chirp.create(data);
            chirp.save();
            res.status(201).send(chirp);
        } catch (err) {
            console.error("Error creating new user:", err.message);
            res.status(500).json({ error: `Internal server error: ${err.message}` });
        }
    })
);

// @desc    Updates and return chirp document by ID
// @route   PATCH /api/chirps:ID
// @access  Public
router.route("/:id").patch(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const updatedChirp = await Chirp.findByIdAndUpdate(req.params.id, req.body, {
                new: true,
                timestamps: true,
            });
            if (!updatedChirp) return res.status(404).send(`Chirp, with ID: ${req.params.id}, doesn't exists.`);
            res.status(200).send(updatedChirp);
        } catch (err) {
            console.error("Error updating chirp:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Removes the chirp document by ID
// @route   DELETE /api/chirps:ID
// @access  Public
router.route("/:id").delete(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const deletedChirp = await Chirp.findByIdAndDelete(req.params.id);
            res.status(200).send(req.params.id);
        } catch (err) {
            console.error("Error delete chirp:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

export default router;
