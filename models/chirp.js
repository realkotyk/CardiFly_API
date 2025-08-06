import mongoose from "mongoose";
const { Schema } = mongoose;

// 1. Define Schema – how will be structure document in DB
const chirpSchema = new Schema(
    {
        parentId: {
            type: Schema.Types.ObjectId,
            require: false,
        },
        author: { type: Schema.Types.ObjectId, require: true, ref: "User" },
        textBody: { type: String, require: true, minlength: 8, maxlength: 120 },
        likesCount: Number,
        dislikesCount: Number,
        isPosted: Boolean,
        pictureUrl: String,
    },
    { timestamps: true, versionKey: false }
);

// 2. Ceate and export the Model
const Chirp = mongoose.model("Chirp", chirpSchema);
export default Chirp;
