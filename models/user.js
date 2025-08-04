import mongoose from "mongoose";
const { Schema } = mongoose;
// 1. Define Schema – how will be structure document in DB
const userSchema = new Schema(
    {
        email: String,
        password: String,
        isBanned: Boolean,
    },
    { timestamps: true, versionKey: false }
);

// 2. Ceate and export the Model
const User = mongoose.model("User", userSchema);
export default User;
