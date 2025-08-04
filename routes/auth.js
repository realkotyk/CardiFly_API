import { Router } from "express";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
import User from "../models/user.js";

const router = Router();

router.route("/login").post(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).send(`User, with E-mail: ${req.body.email}, doesn't exists.`);

    const password = bcrypt.compare(req.body.password, user.password);

    if (!password) {
        res.status(401).send(`Wrong password!`);
        throw new Error(`Wrong password!`);
    }

    console.log(`JWT: ${process.env.JWT_PRIVATE}`);

    const token = jsonwebtoken.sign({ email: user.email, userId: user._id }, process.env.JWT_PRIVATE, {
        expiresIn: "1h",
    });

    if (token) {
        res.status(200).json({ message: "Authentication completed!", token: token });
    } else {
        res.status(401);
        throw new Error(`JWT wasn't processed properly.`);
    }
});

export default router;
