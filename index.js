const express = require("express");
const morgan = require("morgan");

const dbConnection = require("./startup/db");

const app = express();
const port = 3000;

app.use(morgan("dev"));

dbConnection();

const usersRoute = require("./routes/users");

// http://localhost:3000/api/users
app.use("/api/users", usersRoute);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
