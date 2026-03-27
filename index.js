import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import dbConnection from "./startup/db.js";
import authRoute from "./routes/auth.js";
import usersRoute from "./routes/users.js";
import chirpsRoute from "./routes/chirps.js";

// ── Validate required env vars ──────────────────────────────────────────────
const REQUIRED_ENV = ["MONGODB_URL", "JWT_PRIVATE"];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

const app = express();

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Rate limiting — general
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 min
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many requests, please try again later." },
    })
);

// Rate limiting — stricter for auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later." },
});

// ── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Body parsing (Express 5 built-in) ───────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

// ── Database ────────────────────────────────────────────────────────────────
await dbConnection();

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoute);
app.use("/api/users", usersRoute);
app.use("/api/chirps", chirpsRoute);

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error(err.stack || err.message || err);
    const status = err.statusCode || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    });
});

// ── Start server ────────────────────────────────────────────────────────────
const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
    console.log(`CardiFly API listening on port: ${port}`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
    });
    setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
    }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
