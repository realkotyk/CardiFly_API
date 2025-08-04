import { Router } from "express";
import bcrypt from "bcrypt";
import User from "../models/user.js";

const router = Router();

//CRUD - Create, Read, Update, Delete

// Get and return the full listv of users
router.route("/").get(async (req, res) => {
    const users = await User.find();
    res.status(200).send(users);
});

router.route("/:id").get(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send(`User, with ID: ${req.params.id}, doesn't exists.`);

    res.status(200).send(user);
});

// Creaates new user document
router.route("/").post(async (req, res) => {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) return res.status(409).send(`User, with E-mail: ${req.body.email}, already exists.`);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const user = await User.create({ email: req.body.email, password: hashedPassword });
    await user.save();
    res.status(201).send(user);
});

router.route("/:id").patch(async (req, res) => {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, timestamps: true });
    if (!updatedUser) return res.status(404).send(`User, with ID: ${req.params.id}, doesn't exists.`);
    res.status(200).send(updatedUser);
});

router.route("/:id").delete(async (req, res) => {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    res.status(200).send(req.params.id);
});

export default router;
