import mongoose from "mongoose";
const { Schema } = mongoose;
// 1. Define Schema – how will be structure document in DB
const userSchema = new Schema(
    {
        email: { type: String, require: true, default: "" },
        password: { type: String, require: true, default: "" },
        userpicUrl: { type: String, require: false, default: "" },
        isBanned: { type: Boolean, require: false, default: false },
    },
    { timestamps: true, versionKey: false }
);

// 2. Ceate and export the Model
const User = mongoose.model("User", userSchema);
export default User;
