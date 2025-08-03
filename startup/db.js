const mongoose = require("mongoose");
require("dotenv").config();

module.exports = async function dbConnection() {
    const dbConnection = await mongoose.connect(process.env.MONGODB_URL);

    console.log(`Mongo connected to: ${dbConnection.connection.name}`);
};
