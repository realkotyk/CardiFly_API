const mongoose = require("mongoose");

module.exports = async function dbConnection() {
    const connection = await mongoose.connect(process.env.MONGODB_URL);
    console.log(`Mongo connected to: ${connection.connection.name}`);
};
