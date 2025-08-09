// routes/upload.js - Enhanced with baker editing permissions for Draft and Requested Changes stages
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

// Update multer configuration to accept STL files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Increase to 50MB for STL files
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/octet-stream" || // STL files
      file.originalname.toLowerCase().endsWith(".stl")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and STL files are allowed"));
    }
  },
});

// Helper function to check if baker can manage inspiration images
const canBakerManageInspirationImages = (order, user) => {
  return (
    user.role === "baker" &&
    order.bakerId === user.bakerId &&
    (order.stage === "Draft" || order.stage === "Requested Changes")
  );
};

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

// Enhanced image processing function with white background for transparent images
const processImage = async (buffer, maxWidth = 1920, quality = 85) => {
  try {
    // Get image metadata to check for transparency
    const metadata = await sharp(buffer).metadata();

    console.log("📊 Image metadata:", {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      space: metadata.space,
    });

    let sharpInstance = sharp(buffer);

    // If the image has transparency (alpha channel), flatten it with white background
    if (metadata.hasAlpha) {
      console.log(
        "🎨 Image has transparency, flattening with white background"
      );
      sharpInstance = sharpInstance.flatten({
        background: { r: 255, g: 255, b: 255 },
      });
    }

    // Resize if necessary
    if (metadata.width > maxWidth) {
      console.log(
        `📏 Resizing image from ${metadata.width}px to ${maxWidth}px max width`
      );
      sharpInstance = sharpInstance.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    }

    // Convert to JPEG with specified quality
    const processedBuffer = await sharpInstance
      .jpeg({
        quality: quality,
        progressive: true,
        mozjpeg: true, // Use mozjpeg for better compression
      })
      .toBuffer();

    console.log("✅ Image processed successfully", {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      compressionRatio:
        ((1 - processedBuffer.length / buffer.length) * 100).toFixed(1) + "%",
    });

    return processedBuffer;
  } catch (error) {
    console.error("❌ Image processing error:", error);
    // Return original buffer if processing fails
    console.log("⚠️ Returning original buffer due to processing error");
    return buffer;
  }
};

// Enhanced upload inspiration image - supports baker upload in Draft and Requested Changes stages
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
        mimeType: req.file.mimetype,
        userRole: req.user.role,
        userId: req.user._id,
      });

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Enhanced permission checking for inspiration images
      const canUpload =
        req.user.role === "admin" ||
        canBakerManageInspirationImages(order, req.user);

      if (!canUpload) {
        if (req.user.role === "baker") {
          if (order.bakerId !== req.user.bakerId) {
            return res
              .status(403)
              .json({ message: "Access denied to this order" });
          }
          return res.status(403).json({
            message:
              "Can only upload inspiration images in Draft or Requested Changes stages",
            currentStage: order.stage,
            allowedStages: ["Draft", "Requested Changes"],
          });
        }
        return res.status(403).json({ message: "Access denied" });
      }

      // Find the item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Process image with white background for transparent images
      console.log("🔄 Processing image...");
      const processedBuffer = await processImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname
        .split(".")
        .pop()
        .toLowerCase();
      const imageKey = `inspiration/${orderId}/${itemId}/${uuidv4()}.jpg`; // Always save as JPG

      // Upload to S3 with JPEG content type
      console.log("☁️ Uploading to S3...");
      const imageUrl = await uploadToS3(
        processedBuffer,
        imageKey,
        "image/jpeg" // Always JPEG after processing
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
        finalSize: processedBuffer.length,
        orderStage: order.stage,
        uploadedBy: req.user.email,
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
        processing: {
          originalSize: req.file.size,
          processedSize: processedBuffer.length,
          compressionRatio:
            ((1 - processedBuffer.length / req.file.size) * 100).toFixed(1) +
            "%",
          transparencyHandled:
            req.file.mimetype === "image/png"
              ? "Converted to white background"
              : "No transparency",
        },
      });
    } catch (error) {
      console.error("❌ Error uploading inspiration image:", error);
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
        mimeType: req.file.mimetype,
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

      // Process image with white background for transparent images
      console.log("🔄 Processing preview image...");
      const processedBuffer = await processImage(req.file.buffer);

      // Generate unique key for S3
      const fileExtension = req.file.originalname
        .split(".")
        .pop()
        .toLowerCase();
      const imageKey = `preview/${orderId}/${itemId}/${uuidv4()}.jpg`; // Always save as JPG

      // Upload to S3 with JPEG content type
      console.log("☁️ Uploading preview to S3...");
      const imageUrl = await uploadToS3(
        processedBuffer,
        imageKey,
        "image/jpeg" // Always JPEG after processing
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
        finalSize: processedBuffer.length,
        orderStage: order.stage,
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
        processing: {
          originalSize: req.file.size,
          processedSize: processedBuffer.length,
          compressionRatio:
            ((1 - processedBuffer.length / req.file.size) * 100).toFixed(1) +
            "%",
          transparencyHandled:
            req.file.mimetype === "image/png"
              ? "Converted to white background"
              : "No transparency",
        },
      });
    } catch (error) {
      console.error("❌ Error uploading preview image:", error);
      res.status(500).json({
        message: "Failed to upload image",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Enhanced upload STL file - supports baker upload in Draft and Requested Changes stages
// Add new STL upload endpoint
router.post(
  "/stl/:orderId/:itemId",
  requireBakerOrAdmin,
  upload.single("stlFile"),
  async (req, res) => {
    try {
      const { orderId, itemId } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No STL file provided" });
      }

      console.log("📤 Uploading STL file:", {
        orderId,
        itemId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        userRole: req.user.role,
        userId: req.user._id,
      });

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check permissions (same as inspiration images)
      const canUpload =
        req.user.role === "admin" ||
        canBakerManageInspirationImages(order, req.user);

      if (!canUpload) {
        if (req.user.role === "baker") {
          if (order.bakerId !== req.user.bakerId) {
            return res
              .status(403)
              .json({ message: "Access denied to this order" });
          }
          return res.status(403).json({
            message:
              "Can only upload STL files in Draft or Requested Changes stages",
            currentStage: order.stage,
            allowedStages: ["Draft", "Requested Changes"],
          });
        }
        return res.status(403).json({ message: "Access denied" });
      }

      // Find the item
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Verify item is STL type
      if (item.type !== "STL") {
        return res.status(400).json({
          message: "STL files can only be uploaded to STL type items",
        });
      }

      // Generate unique key for S3
      const fileExtension = req.file.originalname
        .split(".")
        .pop()
        .toLowerCase();
      const stlKey = `stl/${orderId}/${itemId}/${uuidv4()}.${fileExtension}`;

      // Upload to S3
      console.log("☁️ Uploading STL to S3...");
      const stlUrl = await uploadToS3(
        req.file.buffer,
        stlKey,
        "application/octet-stream"
      );

      // Add STL file to order item
      const stlData = {
        url: stlUrl,
        key: stlKey,
        uploadedAt: new Date(),
        originalName: req.file.originalname,
      };

      item.stlFiles.push(stlData);
      await order.save();

      console.log("✅ STL file uploaded successfully:", {
        stlUrl,
        stlKey,
        orderId,
        itemId,
        fileSize: req.file.size,
        orderStage: order.stage,
        uploadedBy: req.user.email,
      });

      // Emit real-time update
      const io = req.app.get("io");
      if (io) {
        emitImageUpdate(
          // Reuse image update for STL files
          io,
          orderId,
          itemId,
          stlData,
          "stl_uploaded",
          "stl",
          req.user._id,
          req.user.email
        );
      }

      res.json({
        message: "STL file uploaded successfully",
        stlFile: stlData,
      });
    } catch (error) {
      console.error("❌ Error uploading STL file:", error);
      res.status(500).json({
        message: "Failed to upload STL file",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Enhanced delete image - supports baker deleting inspiration images in Draft and Requested Changes stages
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

    if (!["inspiration", "preview", "stl"].includes(imageType)) {
      return res.status(400).json({
        message:
          "Invalid imageType. Must be 'inspiration', 'preview', or 'stl'",
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

    // Enhanced permission checking
    const isAdmin = req.user.role === "admin";
    const canDeleteInspiration =
      isAdmin || canBakerManageInspirationImages(order, req.user);
    const canDeletePreview = isAdmin;
    const canDeleteSTL =
      isAdmin || canBakerManageInspirationImages(order, req.user);

    if (imageType === "preview" && !canDeletePreview) {
      return res.status(403).json({
        message: "Only admins can delete preview images",
      });
    }

    if (imageType === "inspiration" && !canDeleteInspiration) {
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          return res.status(403).json({
            message: "Access denied to this order",
          });
        }
        return res.status(403).json({
          message:
            "Can only delete inspiration images in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
      }
      return res.status(403).json({
        message: "Access denied",
      });
    }

    if (imageType === "stl" && !canDeleteSTL) {
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          return res.status(403).json({
            message: "Access denied to this order",
          });
        }
        return res.status(403).json({
          message:
            "Can only delete STL files in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
      }
      return res.status(403).json({
        message: "Access denied",
      });
    }

    // Find and remove the image
    // Find and remove the file/image
    let fileArray;
    if (imageType === "inspiration") {
      fileArray = item.inspirationImages;
    } else if (imageType === "preview") {
      fileArray = item.previewImages;
    } else if (imageType === "stl") {
      fileArray = item.stlFiles;
    }

    if (!fileArray) {
      return res.status(404).json({
        message: `No ${imageType} files found for this item`,
      });
    }
    const fileIndex = fileArray.findIndex((file) => file.key === imageKey);

    if (fileIndex === -1) {
      return res.status(404).json({ message: `${imageType} file not found` });
    }

    const fileToDelete = fileArray[fileIndex];
    console.log("🔍 Found file to delete:", {
      url: fileToDelete.url,
      key: fileToDelete.key,
      uploadedAt: fileToDelete.uploadedAt,
      originalName: fileToDelete.originalName || "N/A",
      fileType: imageType,
      orderStage: order.stage,
      deletedBy: req.user.email,
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
    fileArray.splice(fileIndex, 1);
    await order.save();

    console.log("✅ Image deleted from database");

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      // Use appropriate event type based on file type
      const eventType = imageType === "stl" ? "stl_deleted" : "image_deleted";

      emitImageUpdate(
        io,
        orderId,
        itemId,
        fileToDelete,
        eventType,
        imageType,
        req.user._id,
        req.user.email
      );
    }

    // Return appropriate success message
    const fileTypeName =
      imageType === "stl" ? "STL file" : `${imageType} image`;
    res.json({
      message: `${fileTypeName} deleted successfully`,
      deletedFile: fileToDelete,
    });
  } catch (error) {
    console.error("❌ Error deleting image:", error);
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
      imageProcessing: {
        defaultBackground: "white",
        transparencyHandling: "flatten to white background",
        outputFormat: "JPEG",
        defaultQuality: 85,
        maxWidth: 1920,
      },
      permissions: {
        inspirationImages: {
          upload: "Baker (Draft/Requested Changes) + Admin (always)",
          delete: "Baker (Draft/Requested Changes) + Admin (always)",
        },
        previewImages: {
          upload: "Admin only",
          delete: "Admin only",
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting S3 info:", error);
    res.status(500).json({
      message: "Failed to get S3 information",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Test image processing endpoint (development only)
if (process.env.NODE_ENV === "development") {
  router.post(
    "/test-processing",
    requireBakerOrAdmin,
    upload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No image file provided" });
        }

        console.log("🧪 Testing image processing:", {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        });

        // Get original metadata
        const originalMetadata = await sharp(req.file.buffer).metadata();

        // Process image
        const processedBuffer = await processImage(req.file.buffer);

        // Get processed metadata
        const processedMetadata = await sharp(processedBuffer).metadata();

        res.json({
          message: "Image processing test completed",
          original: {
            format: originalMetadata.format,
            width: originalMetadata.width,
            height: originalMetadata.height,
            channels: originalMetadata.channels,
            hasAlpha: originalMetadata.hasAlpha,
            size: req.file.size,
            space: originalMetadata.space,
          },
          processed: {
            format: processedMetadata.format,
            width: processedMetadata.width,
            height: processedMetadata.height,
            channels: processedMetadata.channels,
            hasAlpha: processedMetadata.hasAlpha,
            size: processedBuffer.length,
            space: processedMetadata.space,
          },
          processing: {
            transparencyHandled: originalMetadata.hasAlpha
              ? "Flattened to white background"
              : "No transparency detected",
            compressionRatio:
              ((1 - processedBuffer.length / req.file.size) * 100).toFixed(1) +
              "%",
            backgroundApplied: originalMetadata.hasAlpha
              ? "White (RGB: 255, 255, 255)"
              : "None",
          },
        });
      } catch (error) {
        console.error("❌ Error testing image processing:", error);
        res.status(500).json({
          message: "Image processing test failed",
          error: error.message,
        });
      }
    }
  );
}

module.exports = router;
