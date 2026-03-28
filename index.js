import dotenv from "dotenv";
dotenv.config();

import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import "./startup/db.js";
import authRoute from "./routes/auth.js";
import usersRoute from "./routes/users.js";
import chirpsRoute from "./routes/chirps.js";
import repliesRoute from "./routes/replies.js";
import notificationsRoute from "./routes/notifications.js";
import hashtagsRoute from "./routes/hashtags.js";
import uploadRoute from "./routes/upload.js";
import { startScheduler } from "./scheduler.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(uploadsDir));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const postsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/auth", authLimiter, authRoute);
app.use("/auth", authLimiter, authRoute);
app.use("/api/users", usersRoute);
app.use("/users", usersRoute);
app.use("/api/chirps", postsLimiter, chirpsRoute);
app.use("/posts", postsLimiter, chirpsRoute);
app.use("/replies", repliesRoute);
app.use("/notifications", notificationsRoute);
app.use("/hashtags", hashtagsRoute);
app.use("/api/upload", uploadRoute);
app.use("/upload", uploadRoute);

// Global error handler
app.use((err, req, res, _next) => {
    console.error(err.stack || err.message || err);
    const status = err.statusCode || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
});

const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
    console.log(`CardiFly API listening on port: ${port}`);
});

startScheduler();

// Graceful shutdown
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
