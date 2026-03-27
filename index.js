import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import "./startup/db.js";
import authRoute from "./routes/auth.js";
import usersRoute from "./routes/users.js";
import chirpsRoute from "./routes/chirps.js";

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`CardiFly API listening on port: ${port}`);
});
