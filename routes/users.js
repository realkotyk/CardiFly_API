import { Router } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../models/user.js";
import asyncHandler from "express-async-handler";
import { checkAuth } from "../middlewares/check-auth.js";
import { upload } from "../middlewares/multerUploader.js";
import { uploadFileToS3 } from "../middlewares/s3Upload.js";
import { resizeImage } from "../middlewares/resizeImages.js";

const router = Router();

// @desc    Get and return the full list of users
// @route   GET /api/users
// @access  Private
router.route("/").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        const users = await User.find().select("-password");
        res.status(200).json(users);
    })
);

// @desc    Get and return the user with the specific ID
// @route   GET /api/users/:id
// @access  Private
router.route("/:id").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format." });
        }

        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ error: "User not found." });

        res.status(200).json(user);
    })
);

// @desc    Creates and return the new user document
// @route   POST /api/users
// @access  Public
router.route("/").post(
    upload.single("userpicUrl"),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters." });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: "A user with this email already exists." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let userpicUrl = null;

        if (req.file) {
            const resizedImage = await resizeImage(req.file.buffer);
            userpicUrl = await uploadFileToS3("users", resizedImage, req.file.originalname, req.file.mimetype);
        }

        const newUser = await User.create({
            email,
            password: hashedPassword,
            userpicUrl,
        });

        res.status(201).json({
            _id: newUser._id,
            email: newUser.email,
            userpicUrl: newUser.userpicUrl,
            createdAt: newUser.createdAt,
        });
    })
);

// @desc    Updates and return user document by ID
// @route   PATCH /api/users/:id
// @access  Private
const ALLOWED_UPDATE_FIELDS = ["userpicUrl"];

router.route("/:id").patch(
    checkAuth,
    upload.single("userpicUrl"),
    asyncHandler(async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format." });
        }

        // Only allow whitelisted fields
        const updates = {};
        for (const key of ALLOWED_UPDATE_FIELDS) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (req.file) {
            const resizedImage = await resizeImage(req.file.buffer);
            updates.userpicUrl = await uploadFileToS3("users", resizedImage, req.file.originalname, req.file.mimetype);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update." });
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-password");
        if (!updatedUser) return res.status(404).json({ error: "User not found." });

        res.status(200).json(updatedUser);
    })
);

// @desc    Removes the user document by ID
// @route   DELETE /api/users/:id
// @access  Private
router.route("/:id").delete(
    checkAuth,
    asyncHandler(async (req, res) => {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid user ID format." });
        }

        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ error: "User not found." });

        res.status(200).json({ message: "User deleted.", id: req.params.id });
    })
);

export default router;
