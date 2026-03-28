import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "username, email and password are required." });
    }

    if (await User.findOne({ email })) {
        return res.status(409).json({ error: "Email already in use." });
    }

    if (await User.findOne({ username })) {
        return res.status(409).json({ error: "Username already taken." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password_hash });

    res.status(201).json(user);
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "username and password are required." });
    }

    const user = await User.findOne({ username }).select('+password_hash');
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "24h" }
    );

    res.status(200).json({ token });
});

export default router;
