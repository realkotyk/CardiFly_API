const express = require("express");
const morgan = require("morgan");
require("dotenv").config();

const dbConnection = require("./startup/db");

const app = express();

app.use(morgan("dev"));

dbConnection();

const usersRoute = require("./routes/users");

// http://localhost:3000/api/users
app.use("/api/users", usersRoute);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`CardiFly API listening on port: ${port}`);
});
