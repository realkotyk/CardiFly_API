import sharp from "sharp";

export const resizeImage = async (inputBuffer) => {
    try {
        const resizedImage = await sharp(inputBuffer)
            .resize(200, 200, { fit: "cover" })
            .toBuffer({ resolveWithObject: false });
        return resizedImage;
    } catch (err) {
        console.error(err.message);
    }
};
