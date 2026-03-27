import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const router = Router();

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "username, email and password are required." });
    }

    if (User.findByEmail(email)) {
        return res.status(409).json({ error: "Email already in use." });
    }

    if (User.findByUsername(username)) {
        return res.status(409).json({ error: "Username already taken." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = User.create({ username, email, password_hash });

    res.status(201).json(user);
});

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "username and password are required." });
    }

    const user = User.findByUsername(username);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "24h" }
    );

    res.status(200).json({ token });
});

export default router;
