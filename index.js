import dotenv from "dotenv";
dotenv.config();
import express from "express";
import morgan from "morgan";
import dbConnection from "./startup/db.js";
import authRoute from "./routes/auth.js";
import usersRoute from "./routes/users.js";
import chirpsRoute from "./routes/chirps.js";
import bodyParser from "body-parser";

const app = express();

app.use(morgan("dev"));

dbConnection();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded());

// parse application/json
app.use(bodyParser.json());
app.use("/api/auth", authRoute);
// http://localhost:3000/api/users
app.use("/api/users", usersRoute);
app.use("/api/chirps", chirpsRoute);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`CardiFly API listening on port: ${port}`);
});
