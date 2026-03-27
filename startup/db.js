import mongoose from "mongoose";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

export default async function dbConnection() {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const connection = await mongoose.connect(process.env.MONGODB_URL, {
                serverSelectionTimeoutMS: 5000,
                retryWrites: true,
                w: "majority",
            });
            console.log(`Mongo connected to: ${connection.connection.name}`);

            mongoose.connection.on("error", (err) => {
                console.error("MongoDB connection error:", err.message);
            });

            mongoose.connection.on("disconnected", () => {
                console.warn("MongoDB disconnected. Mongoose will auto-reconnect.");
            });

            return;
        } catch (err) {
            console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
            if (attempt === MAX_RETRIES) {
                console.error("All MongoDB connection attempts failed. Exiting.");
                process.exit(1);
            }
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
    }
}
