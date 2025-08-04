// routes/upload.js - Complete image upload routes with S3 integration
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/Order");
const { requireBakerOrAdmin } = require("../middleware/auth");
const { emitImageUpdate } = require("../utils/socketUtils");

const router = express.Router();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Helper function to upload image to S3
const uploadToS3 = async (buffer, key, contentType) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read", // Make images publicly readable
  };

  const result = await s3.upload(params).promise();
  return result.Location;
};

// Helper function to delete image from S3
const deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
  };

  await s3.deleteObject(params).promise();
};

// Helper function to process image
const processImage = async (buffer, maxWidth = 1920, quality = 85) => {
  try {
    return await sharp(buffer)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();
  } catch (error) {
    console.error("Image processing error:", error);
    // Return original buffer if processing fails
    return buffer;
  }
};

// Upload inspiration image (Baker only)
router.post(
  "/inspiration/:orderId/:itemId",
  requireBakerOrAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { orderId, itemId } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      console.log("📤 Uploading inspiration image:", {
        orderId,
        itemId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        userRole: req.user.role,
        userId: req.user._id,
      });

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check permissions
      if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }

      // Find the item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Process image
      const processedBuffer = await processImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname
        .split(".")
        .pop()
        .toLowerCase();
      const imageKey = `inspiration/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      // Upload to S3
      const imageUrl = await uploadToS3(
        processedBuffer,
        imageKey,
        req.file.mimetype
      );

      // Add image to order item
      const imageData = {
        url: imageUrl,
        key: imageKey,
        uploadedAt: new Date(),
      };

      item.inspirationImages.push(imageData);
      await order.save();

      console.log("✅ Inspiration image uploaded successfully:", {
        imageUrl,
        imageKey,
        orderId,
        itemId,
      });

      // Emit real-time update
      const io = req.app.get("io");
      if (io) {
        emitImageUpdate(
          io,
          orderId,
          itemId,
          imageData,
          "image_uploaded",
          "inspiration",
          req.user._id,
          req.user.email
        );
      }

      res.json({
        message: "Inspiration image uploaded successfully",
        image: imageData,
      });
    } catch (error) {
      console.error("Error uploading inspiration image:", error);
      res.status(500).json({
        message: "Failed to upload image",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
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
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { orderId, itemId } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      console.log("📤 Uploading preview image:", {
        orderId,
        itemId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        userRole: req.user.role,
        userId: req.user._id,
      });

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Find the item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Process image
      const processedBuffer = await processImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname
        .split(".")
        .pop()
        .toLowerCase();
      const imageKey = `preview/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      // Upload to S3
      const imageUrl = await uploadToS3(
        processedBuffer,
        imageKey,
        req.file.mimetype
      );

      // Add image to order item
      const imageData = {
        url: imageUrl,
        key: imageKey,
        uploadedAt: new Date(),
      };

      item.previewImages.push(imageData);
      await order.save();

      console.log("✅ Preview image uploaded successfully:", {
        imageUrl,
        imageKey,
        orderId,
        itemId,
      });

      // Emit real-time update
      const io = req.app.get("io");
      if (io) {
        emitImageUpdate(
          io,
          orderId,
          itemId,
          imageData,
          "image_uploaded",
          "preview",
          req.user._id,
          req.user.email
        );
      }

      res.json({
        message: "Preview image uploaded successfully",
        image: imageData,
      });
    } catch (error) {
      console.error("Error uploading preview image:", error);
      res.status(500).json({
        message: "Failed to upload image",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Delete image (unified endpoint for both inspiration and preview)
router.post("/delete", requireBakerOrAdmin, async (req, res) => {
  try {
    const { orderId, itemId, imageKey, imageType } = req.body;

    console.log("🗑️ Delete image request:", {
      orderId,
      itemId,
      imageKey,
      imageType,
      userRole: req.user.role,
      userId: req.user._id,
    });

    if (!orderId || !itemId || !imageKey || !imageType) {
      return res.status(400).json({
        message:
          "Missing required fields: orderId, itemId, imageKey, imageType",
      });
    }

    if (!["inspiration", "preview"].includes(imageType)) {
      return res.status(400).json({
        message: "Invalid imageType. Must be 'inspiration' or 'preview'",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Find the item
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const isBakerOwner =
      req.user.role === "baker" && order.bakerId === req.user.bakerId;

    if (imageType === "preview" && !isAdmin) {
      return res.status(403).json({
        message: "Only admins can delete preview images",
      });
    }

    if (imageType === "inspiration" && !isAdmin && !isBakerOwner) {
      return res.status(403).json({
        message: "Access denied to this order",
      });
    }

    // Find and remove the image
    const imageArray =
      imageType === "inspiration" ? item.inspirationImages : item.previewImages;
    const imageIndex = imageArray.findIndex((img) => img.key === imageKey);

    if (imageIndex === -1) {
      return res.status(404).json({ message: "Image not found" });
    }

    const imageToDelete = imageArray[imageIndex];
    console.log("🔍 Found image to delete:", {
      url: imageToDelete.url,
      key: imageToDelete.key,
      uploadedAt: imageToDelete.uploadedAt,
    });

    // Remove from S3
    try {
      await deleteFromS3(imageKey);
      console.log("✅ Image deleted from S3:", imageKey);
    } catch (s3Error) {
      console.error("⚠️ Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Remove from database
    imageArray.splice(imageIndex, 1);
    await order.save();

    console.log("✅ Image deleted from database");

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitImageUpdate(
        io,
        orderId,
        itemId,
        imageToDelete,
        "image_deleted",
        imageType,
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: `${imageType} image deleted successfully`,
      deletedImage: imageToDelete,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      message: "Failed to delete image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get S3 bucket info (for debugging)
router.get("/s3-info", requireBakerOrAdmin, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const bucketName = process.env.S3_BUCKET_NAME;

    // Get bucket location
    const location = await s3
      .getBucketLocation({ Bucket: bucketName })
      .promise();

    // Get CORS configuration
    let corsConfig = null;
    try {
      corsConfig = await s3.getBucketCors({ Bucket: bucketName }).promise();
    } catch (corsError) {
      console.log("No CORS configuration found");
    }

    res.json({
      bucketName,
      region: process.env.AWS_REGION,
      location: location.LocationConstraint,
      corsConfigured: !!corsConfig,
      corsRules: corsConfig?.CORSRules || [],
    });
  } catch (error) {
    console.error("Error getting S3 info:", error);
    res.status(500).json({
      message: "Failed to get S3 information",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
