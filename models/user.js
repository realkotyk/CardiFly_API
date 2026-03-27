import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address."],
        },
        password: {
            type: String,
            required: true,
            minlength: [8, "Password must be at least 8 characters."],
        },
        userpicUrl: { type: String, default: "" },
        isBanned: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false }
);

userSchema.index({ email: 1 });

const User = mongoose.model("User", userSchema);
export default User;
