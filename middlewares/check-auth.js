import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";

export const checkAuth = asyncHandler(async (req, res, next) => {
    if (!req.headers.authorization) {
        const error = "Request header doesn't contain any authorization.";
        res.status(401).send(error);
        throw new Error(error);
    }

    if (!req.headers.authorization.startsWith("Bearer")) {
        const error = "Request header doesn't properly use the Bearer authorization method.";
        res.status(401).send(error);
        throw new Error(error);
    }

    try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE);
        req.userData = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: `Authentication Failed: ${error.message}` });
        throw new Error(error);
    }
});
