import mongoose from "mongoose";
const { Schema } = mongoose;

const chirpSchema = new Schema(
    {
        parentId: {
            type: Schema.Types.ObjectId,
            ref: "Chirp",
            default: null,
        },
        author: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        textBody: { type: String, required: true, minlength: 1, maxlength: 280 },
        likesCount: { type: Number, default: 0 },
        dislikesCount: { type: Number, default: 0 },
        isPosted: { type: Boolean, default: true },
        pictureUrl: { type: String, default: null },
    },
    { timestamps: true, versionKey: false }
);

chirpSchema.index({ author: 1 });
chirpSchema.index({ parentId: 1 }, { sparse: true });
chirpSchema.index({ createdAt: -1 });

const Chirp = mongoose.model("Chirp", chirpSchema);
export default Chirp;
