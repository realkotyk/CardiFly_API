// utils/s3Upload.js
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

export const uploadFileToS3 = async (entity, fileBuffer, fileName, mimetype) => {
    const uniqueName = `${entity}/${Date.now()}-${randomUUID()}${path.extname(fileName)}`;

    const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: uniqueName,
        Body: fileBuffer,
        ContentType: mimetype,
        // ACL: "public-read", // optional if you want public access
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Return the public URL
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueName}`;
};
