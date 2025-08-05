import { Router } from "express";
import bcrypt from "bcrypt";
import User from "../models/user.js";
import asyncHandler from "express-async-handler";
import { checkAuth } from "../middlewares/check-auth.js";

const router = Router();

// @desc    Get and return the full list of users
// @route   GET /api/users
// @access  Public
router.route("/").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const users = await User.find().select("-password");
            res.status(200).send(users);
        } catch (err) {
            console.error("Error fetching users:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Get and return the user with the specific ID
// @route   GET /api/users:ID
// @access  Public
router.route("/:id").get(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const user = await User.findById(req.params.id).select("-password");
            if (!user) return res.status(404).send(`User, with ID: ${req.params.id}, doesn't exists.`);

            res.status(200).send(user);
        } catch (err) {
            console.error("Error fetching user:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Creates and return the new user document
// @route   POST /api/users
// @access  Public
router.route("/").post(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const existingUser = await User.findOne({ email: req.body.email });
            if (existingUser) return res.status(409).send(`User, with E-mail: ${req.body.email}, already exists.`);

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.password, salt);
            const user = await User.create({ email: req.body.email, password: hashedPassword });
            await user.save();
            res.status(201).send(user);
        } catch (err) {
            console.error("Error creating new user:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Updates and return user document by ID
// @route   PATCH /api/users:ID
// @access  Public
router.route("/:id").patch(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, timestamps: true });
            if (!updatedUser) return res.status(404).send(`User, with ID: ${req.params.id}, doesn't exists.`);
            res.status(200).send(updatedUser);
        } catch (err) {
            console.error("Error updating user:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

// @desc    Removes the user document by ID
// @route   DELETE /api/users:ID
// @access  Public
router.route("/:id").delete(
    checkAuth,
    asyncHandler(async (req, res) => {
        try {
            const deletedUser = await User.findByIdAndDelete(req.params.id);
            res.status(200).send(req.params.id);
        } catch (err) {
            console.error("Error delete user:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    })
);

export default router;
