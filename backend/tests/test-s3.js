// test-s3.js - Place in your backend folder
const AWS = require("aws-sdk");
require("dotenv").config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function testS3() {
  try {
    // Test upload
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: "test/test-file.txt",
      Body: "Hello from Cookie Cutter App!",
      ContentType: "text/plain",
      ACL: "public-read",
    };

    const result = await s3.upload(uploadParams).promise();
    console.log("✅ Upload successful:", result.Location);

    // Test delete
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: "test/test-file.txt",
      })
      .promise();
    console.log("✅ Delete successful");

    console.log("🎉 S3 configuration is working correctly!");
  } catch (error) {
    console.error("❌ S3 test failed:", error.message);
  }
}

testS3();
