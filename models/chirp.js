import mongoose from "mongoose";
const { Schema } = mongoose;
// 1. Define Schema – how will be structure document in DB
const chirpSchema = new Schema(
    {
        userName: String,
        textBody: String,
        isLiked: Boolean,
        isDisliked: Boolean,
        isReChirped: Boolean,
        isPosted: Boolean,
    },
    { timestamps: true, versionKey: false }
);

// 2. Ceate and export the Model
const Chirp = mongoose.model("Chirp", chirpSchema);
export default Chirp;
