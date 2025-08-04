// test-s3-connection.js
const AWS = require("aws-sdk");
require("dotenv").config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function testS3() {
  try {
    console.log("🔍 Testing S3 configuration...");
    console.log("Bucket:", process.env.S3_BUCKET_NAME);
    console.log("Region:", process.env.AWS_REGION);

    // Test bucket access
    const result = await s3
      .headBucket({
        Bucket: process.env.S3_BUCKET_NAME,
      })
      .promise();

    console.log("✅ S3 bucket accessible!");

    // List existing buckets
    const buckets = await s3.listBuckets().promise();
    console.log("📋 Available buckets:");
    buckets.Buckets.forEach((bucket) => {
      console.log(`  - ${bucket.Name}`);
    });
  } catch (error) {
    console.error("❌ S3 test failed:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);

    if (error.code === "NoSuchBucket") {
      console.log("💡 Solution: Create the bucket or check the bucket name");
    } else if (error.code === "AccessDenied") {
      console.log("💡 Solution: Check your AWS credentials and permissions");
    }
  }
}

testS3();
