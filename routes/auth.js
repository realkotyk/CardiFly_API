import { Router } from "express";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/user.js";

const router = Router();

router.route("/login").post(
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = jsonwebtoken.sign(
            { email: user.email, userId: user._id },
            process.env.JWT_PRIVATE,
            { algorithm: "HS256", expiresIn: "7d" }
        );

        res.status(200).json({
            message: "Authentication completed!",
            token,
            userId: user._id,
            email: user.email,
        });
    })
);

export default router;
