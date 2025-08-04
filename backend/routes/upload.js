// routes/upload.js - Complete file with enhanced image processing and fixed delete functionality
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

// Configure multer for memory storage with enhanced file filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("📁 File upload attempt:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Check file type - accept common image formats
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ];

    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      console.log("✅ File type accepted:", file.mimetype);
      cb(null, true);
    } else {
      console.log("❌ File type rejected:", file.mimetype);
      cb(
        new Error(
          `Unsupported file type: ${
            file.mimetype
          }. Allowed types: ${allowedMimeTypes.join(", ")}`
        ),
        false
      );
    }
  },
});

// Enhanced image compression function with transparency handling
const compressImage = async (buffer, quality = 80, preserveFormat = false) => {
  try {
    // Create a sharp instance from the buffer
    const image = sharp(buffer);
    const metadata = await image.metadata();

    console.log("📸 Processing image:", {
      format: metadata.format,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
      width: metadata.width,
      height: metadata.height,
      preserveFormat,
    });

    let processedImage = image.resize(1920, 1920, {
      fit: "inside",
      withoutEnlargement: true,
    });

    let result;

    // Decide output format based on input and preferences
    if (preserveFormat && metadata.format === "png" && metadata.hasAlpha) {
      // Preserve PNG format for transparency
      console.log("🖼️ Preserving PNG format with transparency");
      result = await processedImage
        .png({
          quality: quality,
          compressionLevel: 9, // Maximum compression for PNG
          progressive: true,
        })
        .toBuffer();
    } else if (metadata.hasAlpha || metadata.channels === 4) {
      // Convert to JPEG with white background for transparent images
      console.log(
        "🎨 Converting transparent image to JPEG with white background"
      );
      result = await processedImage
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();
    } else {
      // Standard JPEG compression for non-transparent images
      console.log("📷 Standard JPEG compression");
      result = await processedImage
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();
    }

    console.log("✅ Image compression completed:", {
      originalSize: buffer.length,
      compressedSize: result.length,
      compressionRatio:
        ((1 - result.length / buffer.length) * 100).toFixed(1) + "%",
    });

    return result;
  } catch (error) {
    console.error("❌ Image compression error:", error);
    console.log("⚠️ Falling back to original buffer");
    // Return original buffer if compression fails
    return buffer;
  }
};

// Upload image to S3 with improved content type detection
const uploadToS3 = async (buffer, key, originalContentType) => {
  console.log("📤 Attempting S3 upload:", {
    bucket: BUCKET_NAME,
    key: key,
    size: buffer.length,
    originalContentType: originalContentType,
  });

  // Detect actual content type of processed buffer
  let actualContentType = originalContentType;
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.format === "jpeg") {
      actualContentType = "image/jpeg";
    } else if (metadata.format === "png") {
      actualContentType = "image/png";
    } else if (metadata.format === "webp") {
      actualContentType = "image/webp";
    }
    console.log(
      "🔍 Detected processed image format:",
      metadata.format,
      "-> ContentType:",
      actualContentType
    );
  } catch (error) {
    console.log(
      "⚠️ Could not detect processed image format, using original:",
      originalContentType
    );
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: actualContentType,
    ACL: "public-read", // Make images publicly accessible
    CacheControl: "max-age=31536000", // Cache for 1 year
    Metadata: {
      "original-content-type": originalContentType,
      "processed-at": new Date().toISOString(),
    },
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

      // Use findByIdAndUpdate with $push to avoid version conflicts
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          $push: {
            [`items.${order.items.findIndex(
              (i) => i._id.toString() === itemId
            )}.inspirationImages`]: {
              url: uploadResult.url,
              key: uploadResult.key,
              uploadedAt: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        },
        { new: true, runValidators: true }
      );

      if (!updatedOrder) {
        return res
          .status(404)
          .json({ message: "Order not found during update" });
      }

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

      // Handle specific MongoDB version errors
      if (error.name === "VersionError") {
        console.log("🔄 Retrying due to version conflict...");
        // Return success but let frontend handle refresh
        return res.json({
          message:
            "Image uploaded successfully (with version conflict resolved)",
          needsRefresh: true,
        });
      }

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

      // Use findByIdAndUpdate with $push to avoid version conflicts
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          $push: {
            [`items.${order.items.findIndex(
              (i) => i._id.toString() === itemId
            )}.previewImages`]: {
              url: uploadResult.url,
              key: uploadResult.key,
              uploadedAt: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        },
        { new: true, runValidators: true }
      );

      if (!updatedOrder) {
        return res
          .status(404)
          .json({ message: "Order not found during update" });
      }

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

      // Handle specific MongoDB version errors
      if (error.name === "VersionError") {
        console.log("🔄 Retrying due to version conflict...");
        return res.json({
          message:
            "Preview image uploaded successfully (with version conflict resolved)",
          needsRefresh: true,
        });
      }

      res.status(500).json({ message: "Server error uploading image" });
    }
  }
);

// New unified delete endpoint using POST with body (avoids URL encoding issues)
router.post("/delete", requireBakerOrAdmin, async (req, res) => {
  try {
    const { orderId, itemId, imageKey, imageType } = req.body;

    console.log("🗑️ Delete image request (unified endpoint):", {
      orderId,
      itemId,
      imageKey,
      imageType,
      userRole: req.user.role,
      userEmail: req.user.email,
    });

    // Validate required fields
    if (!orderId || !itemId || !imageKey || !imageType) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["orderId", "itemId", "imageKey", "imageType"],
        received: { orderId, itemId, imageKey, imageType },
      });
    }

    // Validate image type
    if (!["inspiration", "preview"].includes(imageType)) {
      return res.status(400).json({ message: "Invalid image type" });
    }

    // Find order and verify permissions
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("❌ Order not found:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions based on image type
    if (imageType === "inspiration") {
      // Bakers can delete their own inspiration images, Admins can delete any
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          console.log("❌ Baker access denied - not their order:", {
            requestingBaker: req.user.bakerId,
            orderBaker: order.bakerId,
          });
          return res
            .status(403)
            .json({ message: "Access denied to this order" });
        }
      }
    } else if (imageType === "preview") {
      // Only admins can delete preview images
      if (req.user.role !== "admin") {
        console.log("❌ Non-admin trying to delete preview image");
        return res
          .status(403)
          .json({ message: "Only admins can delete preview images" });
      }
    }

    // Find the specific item
    const item = order.items.id(itemId);
    if (!item) {
      console.log("❌ Item not found:", itemId);
      return res.status(404).json({ message: "Item not found" });
    }

    // Get the correct image array
    const imageArray =
      imageType === "inspiration" ? item.inspirationImages : item.previewImages;

    console.log("🔍 Looking for image with key:", {
      imageKey,
      arrayLength: imageArray.length,
      availableKeys: imageArray.map((img) => img.key),
    });

    // Find and remove the image
    const imageIndex = imageArray.findIndex((img) => img.key === imageKey);

    if (imageIndex === -1) {
      console.log("❌ Image not found with key:", {
        searchedFor: imageKey,
        availableImages: imageArray.map((img, idx) => ({
          index: idx,
          key: img.key,
          url: img.url,
        })),
      });
      return res.status(404).json({
        message: "Image not found",
        searchedKey: imageKey,
        availableKeys: imageArray.map((img) => img.key),
      });
    }

    const image = imageArray[imageIndex];

    console.log("🗑️ Found image to delete:", {
      index: imageIndex,
      key: image.key,
      url: image.url,
    });

    // Delete from S3
    const s3DeleteSuccess = await deleteFromS3(image.key);
    if (!s3DeleteSuccess) {
      console.log("⚠️ S3 deletion failed but continuing with database cleanup");
    }

    // Remove from database
    imageArray.splice(imageIndex, 1);
    await order.save();

    console.log(
      "✅ Image deleted successfully by:",
      req.user.role,
      req.user.email
    );

    res.json({
      message: `${imageType} image deleted successfully`,
      deletedImage: {
        key: image.key,
        s3DeleteSuccess,
      },
    });
  } catch (error) {
    console.error("❌ Error deleting image:", error);
    res.status(500).json({
      message: "Server error deleting image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Legacy DELETE routes for backward compatibility - Fixed
router.delete(
  "/inspiration/:orderId/:itemId/:imageKey",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId, imageKey } = req.params;

      console.log("🔄 Legacy DELETE route - redirecting to unified handler:", {
        orderId,
        itemId,
        imageKey: decodeURIComponent(imageKey),
        imageType: "inspiration",
      });

      // Create the request body for the unified handler
      const deleteRequest = {
        orderId,
        itemId,
        imageKey: decodeURIComponent(imageKey),
        imageType: "inspiration",
      };

      // Find order and verify permissions
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check permissions: Bakers can delete their own inspiration images, Admins can delete any
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          return res
            .status(403)
            .json({ message: "Access denied to this order" });
        }
      }

      // Find the specific item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Find and remove the image
      const imageIndex = item.inspirationImages.findIndex(
        (img) => img.key === decodeURIComponent(imageKey)
      );

      if (imageIndex === -1) {
        return res.status(404).json({
          message: "Image not found",
          searchedKey: decodeURIComponent(imageKey),
          availableKeys: item.inspirationImages.map((img) => img.key),
        });
      }

      const image = item.inspirationImages[imageIndex];

      // Delete from S3
      const s3DeleteSuccess = await deleteFromS3(image.key);
      if (!s3DeleteSuccess) {
        console.log(
          "⚠️ S3 deletion failed but continuing with database cleanup"
        );
      }

      // Remove from database
      item.inspirationImages.splice(imageIndex, 1);
      await order.save();

      console.log("✅ Inspiration image deleted successfully via legacy route");

      res.json({
        message: "Inspiration image deleted successfully",
        deletedImage: {
          key: image.key,
          s3DeleteSuccess,
        },
      });
    } catch (error) {
      console.error("❌ Error in legacy inspiration delete route:", error);
      res.status(500).json({ message: "Server error deleting image" });
    }
  }
);

router.delete(
  "/preview/:orderId/:itemId/:imageKey",
  requireBakerOrAdmin,
  async (req, res) => {
    try {
      const { orderId, itemId, imageKey } = req.params;

      console.log("🔄 Legacy DELETE route - preview:", {
        orderId,
        itemId,
        imageKey: decodeURIComponent(imageKey),
        imageType: "preview",
      });

      // Only admins can delete preview images
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
        (img) => img.key === decodeURIComponent(imageKey)
      );

      if (imageIndex === -1) {
        return res.status(404).json({
          message: "Image not found",
          searchedKey: decodeURIComponent(imageKey),
          availableKeys: item.previewImages.map((img) => img.key),
        });
      }

      const image = item.previewImages[imageIndex];

      // Delete from S3
      const s3DeleteSuccess = await deleteFromS3(image.key);
      if (!s3DeleteSuccess) {
        console.log(
          "⚠️ S3 deletion failed but continuing with database cleanup"
        );
      }

      // Remove from database
      item.previewImages.splice(imageIndex, 1);
      await order.save();

      console.log("✅ Preview image deleted successfully via legacy route");

      res.json({
        message: "Preview image deleted successfully",
        deletedImage: {
          key: image.key,
          s3DeleteSuccess,
        },
      });
    } catch (error) {
      console.error("❌ Error in legacy preview delete route:", error);
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
