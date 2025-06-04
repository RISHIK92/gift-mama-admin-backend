// import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
// import { Upload } from "@aws-sdk/lib-storage";
// import dotenv from "dotenv";

// dotenv.config();

// const s3 = new S3Client({
//     region: process.env.AWS_REGION,
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//     }
// });

// const checkBucket = async (bucket) => {
//     try {
//         await s3.send(new HeadBucketCommand({ Bucket: bucket }));
//         console.log(`S3 Bucket: ${bucket} exists`);
//     } catch (error) {
//         if (error.name === "NotFound") {
//             await s3.send(new CreateBucketCommand({ Bucket: bucket }));
//             console.log(`S3 Bucket: ${bucket} created`);
//         } else {
//             console.error("Error checking bucket:", error);
//         }
//     }
// };

// // Ensure the bucket exists
// await checkBucket(process.env.AWS_BUCKET_NAME);

// // File Upload Function
// const uploadFileToS3 = async (fileBuffer, fileName, fileType) => {
//     const uploadParams = {
//         client: s3,
//         params: {
//             Bucket: process.env.AWS_BUCKET_NAME,
//             Key: fileName,
//             Body: fileBuffer,
//             ContentType: fileType,
//         }
//     };

//     const upload = new Upload(uploadParams);

//     try {
//         const result = await upload.done();
//         return result.Location; // Returns the file URL
//     } catch (error) {
//         console.error("Upload failed:", error);
//         throw error;
//     }
// };

// export { s3, uploadFileToS3 };

import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const checkBucket = async (bucket) => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`S3 Bucket: ${bucket} exists`);
  } catch (error) {
    if (error.name === "NotFound") {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`S3 Bucket: ${bucket} created`);
    } else {
      console.error("Error checking bucket:", error);
    }
  }
};

// Ensure the bucket exists
await checkBucket(process.env.AWS_BUCKET_NAME);

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

// File Upload Function
const uploadFileToS3 = async (fileBuffer, fileName, fileType) => {
  const key = fileName; // key = path in bucket
  const uploadParams = {
    client: s3,
    params: {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: fileType,
    },
  };

  const upload = new Upload(uploadParams);

  try {
    await upload.done();

    const cloudfrontUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;
    return cloudfrontUrl;
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
};

export { s3, uploadFileToS3 };
