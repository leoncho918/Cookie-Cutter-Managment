// routes/upload.js - File upload routes with S3 integration
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/Order");
const { requireBakerOrAdmin } = require("../middleware/auth");

// Load environment variables
require("dotenv").config();

const router = express.Router();

// Configure AWS S3 with explicit configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Debug S3 configuration
console.log("🔍 S3 Upload Configuration:");
console.log("  Region:", process.env.AWS_REGION);
console.log("  Bucket:", BUCKET_NAME);
console.log(
  "  Access Key ID:",
  process.env.AWS_ACCESS_KEY_ID
    ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 4)}...`
    : "NOT SET"
);
console.log(
  "  Secret Key:",
  process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "NOT SET"
);

// Validate required environment variables
if (
  !process.env.AWS_ACCESS_KEY_ID ||
  !process.env.AWS_SECRET_ACCESS_KEY ||
  !process.env.AWS_REGION ||
  !BUCKET_NAME
) {
  console.error("❌ Missing required AWS environment variables:");
  console.error("  AWS_ACCESS_KEY_ID:", !!process.env.AWS_ACCESS_KEY_ID);
  console.error(
    "  AWS_SECRET_ACCESS_KEY:",
    !!process.env.AWS_SECRET_ACCESS_KEY
  );
  console.error("  AWS_REGION:", !!process.env.AWS_REGION);
  console.error("  S3_BUCKET_NAME:", !!BUCKET_NAME);
}

// Test S3 connection on startup
s3.headBucket({ Bucket: BUCKET_NAME }, (err, data) => {
  if (err) {
    console.error(
      "❌ S3 bucket test failed on startup:",
      err.code,
      err.message
    );
    console.error(
      "   Make sure your .env file has the correct AWS credentials and bucket name"
    );
  } else {
    console.log("✅ S3 bucket accessible on startup");
  }
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Image compression function
const compressImage = async (buffer, quality = 80) => {
  try {
    return await sharp(buffer)
      .resize(1920, 1920, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer();
  } catch (error) {
    console.error("Image compression error:", error);
    // Return original buffer if compression fails
    return buffer;
  }
};

// Upload image to S3
const uploadToS3 = async (buffer, key, contentType) => {
  console.log("📤 Attempting S3 upload:", {
    bucket: BUCKET_NAME,
    key: key,
    size: buffer.length,
    contentType: contentType,
  });

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read", // Make images publicly accessible
  };

  try {
    const result = await s3.upload(params).promise();
    console.log("✅ S3 upload successful:", result.Location);
    return {
      url: result.Location,
      key: result.Key,
    };
  } catch (error) {
    console.error("❌ S3 upload error details:", {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      bucket: BUCKET_NAME,
      key: key,
      region: process.env.AWS_REGION,
    });

    // Additional debugging
    if (error.code === "NoSuchBucket") {
      console.error("🔍 Debug info:");
      console.error("  - Bucket name from env:", process.env.S3_BUCKET_NAME);
      console.error("  - Region from env:", process.env.AWS_REGION);
      console.error("  - Trying to access bucket:", BUCKET_NAME);

      // Test if we can list buckets
      try {
        const buckets = await s3.listBuckets().promise();
        console.error(
          "  - Available buckets:",
          buckets.Buckets.map((b) => b.Name)
        );
      } catch (listError) {
        console.error("  - Cannot list buckets:", listError.message);
      }
    }

    throw new Error("Failed to upload image to S3");
  }
};

// Delete image from S3
const deleteFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
    console.log("✅ S3 delete successful:", key);
    return true;
  } catch (error) {
    console.error("❌ S3 delete error:", error);
    return false;
  }
};

// Upload inspiration image (Baker only)
router.post(
  "/inspiration/:orderId/:itemId",
  requireBakerOrAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("📁 Inspiration image upload started:", {
        orderId: req.params.orderId,
        itemId: req.params.itemId,
        user: req.user.email,
        hasFile: !!req.file,
      });

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { orderId, itemId } = req.params;

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Only bakers can upload inspiration images
      if (req.user.role !== "baker") {
        return res
          .status(403)
          .json({ message: "Only bakers can upload inspiration images" });
      }

      // Compress image
      console.log("🗜️ Compressing image...");
      const compressedBuffer = await compressImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname.split(".").pop();
      const key = `inspiration/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      console.log("📤 Uploading to S3 with key:", key);

      // Upload to S3
      const uploadResult = await uploadToS3(
        compressedBuffer,
        key,
        req.file.mimetype
      );

      // Add image to item
      item.inspirationImages.push({
        url: uploadResult.url,
        key: uploadResult.key,
        uploadedAt: new Date(),
      });

      await order.save();

      console.log("✅ Inspiration image upload completed");

      res.json({
        message: "Inspiration image uploaded successfully",
        image: {
          url: uploadResult.url,
          key: uploadResult.key,
        },
      });
    } catch (error) {
      console.error("❌ Error uploading inspiration image:", error);
      res.status(500).json({ message: "Server error uploading image" });
    }
  }
);

// Upload preview image (Admin only)
router.post(
  "/preview/:orderId/:itemId",
  requireBakerOrAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("🖼️ Preview image upload started:", {
        orderId: req.params.orderId,
        itemId: req.params.itemId,
        user: req.user.email,
        hasFile: !!req.file,
      });

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { orderId, itemId } = req.params;

      // Only admins can upload preview images
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admins can upload preview images" });
      }

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Compress image
      console.log("🗜️ Compressing preview image...");
      const compressedBuffer = await compressImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname.split(".").pop();
      const key = `preview/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      console.log("📤 Uploading preview to S3 with key:", key);

      // Upload to S3
      const uploadResult = await uploadToS3(
        compressedBuffer,
        key,
        req.file.mimetype
      );

      // Add image to item
      item.previewImages.push({
        url: uploadResult.url,
        key: uploadResult.key,
        uploadedAt: new Date(),
      });

      await order.save();

      console.log("✅ Preview image upload completed");

      res.json({
        message: "Preview image uploaded successfully",
        image: {
          url: uploadResult.url,
          key: uploadResult.key,
        },
      });
    } catch (error) {
      console.error("❌ Error uploading preview image:", error);
      res.status(500).json({ message: "Server error uploading image" });
    }
  }
);

// Delete inspiration image
router.delete(
  "/inspiration/:orderId/:itemId/:imageKey",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId, imageKey } = req.params;

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check permissions
      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Find and remove the image
      const imageIndex = item.inspirationImages.findIndex(
        (img) => img.key === imageKey
      );
      if (imageIndex === -1) {
        return res.status(404).json({ message: "Image not found" });
      }

      const image = item.inspirationImages[imageIndex];

      // Delete from S3
      await deleteFromS3(image.key);

      // Remove from database
      item.inspirationImages.splice(imageIndex, 1);
      await order.save();

      res.json({ message: "Inspiration image deleted successfully" });
    } catch (error) {
      console.error("Error deleting inspiration image:", error);
      res.status(500).json({ message: "Server error deleting image" });
    }
  }
);

// Delete preview image (Admin only)
router.delete(
  "/preview/:orderId/:itemId/:imageKey",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId, imageKey } = req.params;

      // Only admins can delete preview images (or admins can delete any images)
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admins can delete preview images" });
      }

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Find and remove the image
      const imageIndex = item.previewImages.findIndex(
        (img) => img.key === imageKey
      );
      if (imageIndex === -1) {
        return res.status(404).json({ message: "Image not found" });
      }

      const image = item.previewImages[imageIndex];

      // Delete from S3
      await deleteFromS3(image.key);

      // Remove from database
      item.previewImages.splice(imageIndex, 1);
      await order.save();

      res.json({ message: "Preview image deleted successfully" });
    } catch (error) {
      console.error("Error deleting preview image:", error);
      res.status(500).json({ message: "Server error deleting image" });
    }
  }
);

// Get signed URL for direct upload (alternative method)
router.post("/signed-url", requireBakerOrAdmin, async (req, res) => {
  try {
    const { fileName, fileType, imageType, orderId, itemId } = req.body;

    if (!fileName || !fileType || !imageType || !orderId || !itemId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    if (!["inspiration", "preview"].includes(imageType)) {
      return res.status(400).json({ message: "Invalid image type" });
    }

    // Check permissions
    if (imageType === "preview" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can upload preview images" });
    }

    // Generate unique key
    const key = `${imageType}/${orderId}/${itemId}/${uuidv4()}-${fileName}`;

    // Generate signed URL
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 300, // 5 minutes
      ContentType: fileType,
      ACL: "public-read",
    };

    const signedUrl = s3.getSignedUrl("putObject", params);
    const imageUrl = `https://${BUCKET_NAME}.s3.${
      process.env.AWS_REGION || "us-east-1"
    }.amazonaws.com/${key}`;

    res.json({
      signedUrl,
      imageUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ message: "Server error generating signed URL" });
  }
});

// Confirm image upload (for use with signed URLs)
router.post(
  "/confirm/:orderId/:itemId",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      const { imageUrl, imageKey, imageType } = req.body;

      if (!imageUrl || !imageKey || !imageType) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Add image to appropriate array
      const imageData = {
        url: imageUrl,
        key: imageKey,
        uploadedAt: new Date(),
      };

      if (imageType === "inspiration") {
        item.inspirationImages.push(imageData);
      } else if (imageType === "preview") {
        item.previewImages.push(imageData);
      } else {
        return res.status(400).json({ message: "Invalid image type" });
      }

      await order.save();

      res.json({
        message: `${imageType} image confirmed successfully`,
        image: imageData,
      });
    } catch (error) {
      console.error("Error confirming image upload:", error);
      res.status(500).json({ message: "Server error confirming upload" });
    }
  }
);

module.exports = router;

// Upload inspiration image (Baker only)
router.post(
  "/inspiration/:orderId/:itemId",
  requireBakerOrAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { orderId, itemId } = req.params;

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Only bakers can upload inspiration images
      if (req.user.role !== "baker") {
        return res
          .status(403)
          .json({ message: "Only bakers can upload inspiration images" });
      }

      // Compress image
      const compressedBuffer = await compressImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname.split(".").pop();
      const key = `inspiration/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      // Upload to S3
      const uploadResult = await uploadToS3(
        compressedBuffer,
        key,
        req.file.mimetype
      );

      // Add image to item
      item.inspirationImages.push({
        url: uploadResult.url,
        key: uploadResult.key,
        uploadedAt: new Date(),
      });

      await order.save();

      res.json({
        message: "Inspiration image uploaded successfully",
        image: {
          url: uploadResult.url,
          key: uploadResult.key,
        },
      });
    } catch (error) {
      console.error("Error uploading inspiration image:", error);
      res.status(500).json({ message: "Server error uploading image" });
    }
  }
);

// Upload preview image (Admin only)
router.post(
  "/preview/:orderId/:itemId",
  requireBakerOrAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { orderId, itemId } = req.params;

      // Only admins can upload preview images
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admins can upload preview images" });
      }

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Compress image
      const compressedBuffer = await compressImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname.split(".").pop();
      const key = `preview/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      // Upload to S3
      const uploadResult = await uploadToS3(
        compressedBuffer,
        key,
        req.file.mimetype
      );

      // Add image to item
      item.previewImages.push({
        url: uploadResult.url,
        key: uploadResult.key,
        uploadedAt: new Date(),
      });

      await order.save();

      res.json({
        message: "Preview image uploaded successfully",
        image: {
          url: uploadResult.url,
          key: uploadResult.key,
        },
      });
    } catch (error) {
      console.error("Error uploading preview image:", error);
      res.status(500).json({ message: "Server error uploading image" });
    }
  }
);

// Delete inspiration image
router.delete(
  "/inspiration/:orderId/:itemId/:imageKey",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId, imageKey } = req.params;

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check permissions
      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Find and remove the image
      const imageIndex = item.inspirationImages.findIndex(
        (img) => img.key === imageKey
      );
      if (imageIndex === -1) {
        return res.status(404).json({ message: "Image not found" });
      }

      const image = item.inspirationImages[imageIndex];

      // Delete from S3
      await deleteFromS3(image.key);

      // Remove from database
      item.inspirationImages.splice(imageIndex, 1);
      await order.save();

      res.json({ message: "Inspiration image deleted successfully" });
    } catch (error) {
      console.error("Error deleting inspiration image:", error);
      res.status(500).json({ message: "Server error deleting image" });
    }
  }
);

// Delete preview image (Admin only)
router.delete(
  "/preview/:orderId/:itemId/:imageKey",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId, imageKey } = req.params;

      // Only admins can delete preview images (or admins can delete any images)
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admins can delete preview images" });
      }

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Find and remove the image
      const imageIndex = item.previewImages.findIndex(
        (img) => img.key === imageKey
      );
      if (imageIndex === -1) {
        return res.status(404).json({ message: "Image not found" });
      }

      const image = item.previewImages[imageIndex];

      // Delete from S3
      await deleteFromS3(image.key);

      // Remove from database
      item.previewImages.splice(imageIndex, 1);
      await order.save();

      res.json({ message: "Preview image deleted successfully" });
    } catch (error) {
      console.error("Error deleting preview image:", error);
      res.status(500).json({ message: "Server error deleting image" });
    }
  }
);

// Get signed URL for direct upload (alternative method)
router.post("/signed-url", requireBakerOrAdmin, async (req, res) => {
  try {
    const { fileName, fileType, imageType, orderId, itemId } = req.body;

    if (!fileName || !fileType || !imageType || !orderId || !itemId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    if (!["inspiration", "preview"].includes(imageType)) {
      return res.status(400).json({ message: "Invalid image type" });
    }

    // Check permissions
    if (imageType === "preview" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can upload preview images" });
    }

    // Generate unique key
    const key = `${imageType}/${orderId}/${itemId}/${uuidv4()}-${fileName}`;

    // Generate signed URL
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 300, // 5 minutes
      ContentType: fileType,
      ACL: "public-read",
    };

    const signedUrl = s3.getSignedUrl("putObject", params);
    const imageUrl = `https://${BUCKET_NAME}.s3.${
      process.env.AWS_REGION || "us-east-1"
    }.amazonaws.com/${key}`;

    res.json({
      signedUrl,
      imageUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ message: "Server error generating signed URL" });
  }
});

// Confirm image upload (for use with signed URLs)
router.post(
  "/confirm/:orderId/:itemId",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId } = req.params;
      const { imageUrl, imageKey, imageType } = req.body;

      if (!imageUrl || !imageKey || !imageType) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Add image to appropriate array
      const imageData = {
        url: imageUrl,
        key: imageKey,
        uploadedAt: new Date(),
      };

      if (imageType === "inspiration") {
        item.inspirationImages.push(imageData);
      } else if (imageType === "preview") {
        item.previewImages.push(imageData);
      } else {
        return res.status(400).json({ message: "Invalid image type" });
      }

      await order.save();

      res.json({
        message: `${imageType} image confirmed successfully`,
        image: imageData,
      });
    } catch (error) {
      console.error("Error confirming image upload:", error);
      res.status(500).json({ message: "Server error confirming upload" });
    }
  }
);

module.exports = router;
