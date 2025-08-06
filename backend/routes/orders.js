// routes/orders.js - Enhanced orders routes with baker email filtering
const express = require("express");
const Order = require("../models/Order");
const { requireAdmin, requireBakerOrAdmin } = require("../middleware/auth");
const { sendOrderStageChangeEmail } = require("../utils/email");
const { emitOrderUpdate } = require("../utils/socketUtils");

const router = express.Router();

// Get all orders (with enhanced filtering including baker email)
router.get("/", requireBakerOrAdmin, async (req, res) => {
  try {
    let query = {};

    // If user is baker, only show their orders
    if (req.user.role === "baker") {
      query.bakerId = req.user.bakerId;
    }

    // Apply filters from query parameters
    const { stage, bakerId, bakerEmail, dateFrom, dateTo } = req.query;

    if (stage) query.stage = stage;
    if (bakerId && req.user.role === "admin") query.bakerId = bakerId;

    // NEW: Baker email filtering (admin only)
    if (bakerEmail && req.user.role === "admin") {
      query.bakerEmail = { $regex: new RegExp(bakerEmail, "i") }; // Case-insensitive search
    }

    if (dateFrom || dateTo) {
      query.dateRequired = {};
      if (dateFrom) query.dateRequired.$gte = new Date(dateFrom);
      if (dateTo) query.dateRequired.$lte = new Date(dateTo);
    }

    console.log("📋 Orders query with filters:", {
      query,
      userRole: req.user.role,
      userId: req.user._id,
      filters: { stage, bakerId, bakerEmail, dateFrom, dateTo },
    });

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("stageHistory.changedBy", "email bakerId");

    console.log("✅ Orders found:", {
      count: orders.length,
      filterApplied: Object.keys(req.query).length > 0,
    });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error fetching orders" });
  }
});

// Get single order by ID
router.get("/:id", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "stageHistory.changedBy",
      "email bakerId"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if baker can access this order
    if (req.user.role === "baker" && order.bakerId !== req.user.bakerId) {
      return res.status(403).json({ message: "Access denied to this order" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Server error fetching order" });
  }
});

// Create new order (Baker only)
router.post("/", async (req, res) => {
  try {
    if (req.user.role !== "baker") {
      return res.status(403).json({ message: "Only bakers can create orders" });
    }

    const { dateRequired, items } = req.body;

    if (!dateRequired) {
      return res.status(400).json({ message: "Date required is mandatory" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // Validate items
    for (const item of items) {
      if (
        !item.type ||
        !["Cutter", "Stamp", "Stamp & Cutter"].includes(item.type)
      ) {
        return res.status(400).json({ message: "Invalid item type" });
      }

      // Validate measurement
      if (
        !item.measurement ||
        !item.measurement.value ||
        item.measurement.value <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Valid measurement is required for all items" });
      }

      if (
        !item.measurement.unit ||
        !["cm", "mm"].includes(item.measurement.unit)
      ) {
        return res
          .status(400)
          .json({ message: "Valid measurement unit is required" });
      }
    }

    // Generate order number manually
    const lastOrder = await Order.findOne(
      { bakerId: req.user.bakerId },
      {},
      { sort: { createdAt: -1 } }
    );

    let nextNumber = 1;
    if (lastOrder && lastOrder.orderNumber) {
      // Extract number from orderNumber (e.g., B001-005 -> 5)
      const parts = lastOrder.orderNumber.split("-");
      if (parts.length === 2) {
        const lastNumber = parseInt(parts[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    const orderNumber = `${req.user.bakerId}-${nextNumber
      .toString()
      .padStart(3, "0")}`;

    const order = new Order({
      orderNumber: orderNumber,
      bakerId: req.user.bakerId,
      bakerEmail: req.user.email,
      dateRequired: new Date(dateRequired),
      items,
      stage: "Draft",
    });

    await order.save();

    console.log("📋 Order created:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      bakerId: order.bakerId,
      itemCount: order.items.length,
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "created",
        req.user._id,
        req.user.email
      );
    }

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error creating order" });
  }
});

// Update order (Baker can update draft orders, Admin can update any)
router.put("/:id", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (req.user.role === "baker") {
      if (order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      if (order.stage !== "Draft") {
        return res.status(403).json({ message: "Can only edit draft orders" });
      }
    }

    const { dateRequired, items, additionalComments } = req.body;

    // Store original values for comparison
    const originalOrder = {
      dateRequired: order.dateRequired,
      itemsCount: order.items.length,
    };

    // Update allowed fields
    if (dateRequired) order.dateRequired = new Date(dateRequired);
    if (items) order.items = items;
    if (additionalComments !== undefined)
      order.additionalComments = additionalComments;

    await order.save();

    console.log("📋 Order updated:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      updatedBy: req.user.email,
      changes: {
        dateChanged:
          originalOrder.dateRequired.getTime() !== order.dateRequired.getTime(),
        itemsChanged: originalOrder.itemsCount !== order.items.length,
      },
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "updated",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Server error updating order" });
  }
});

// Update order stage
router.put("/:id/stage", requireBakerOrAdmin, async (req, res) => {
  try {
    const { stage, comments, price } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions and valid stage transitions
    const currentStage = order.stage;
    const isAdmin = req.user.role === "admin";
    const isBaker = req.user.role === "baker";

    // Define allowed transitions for different roles
    const adminAllowedTransitions = {
      Draft: ["Submitted", "Under Review"],
      Submitted: ["Under Review", "Draft"],
      "Under Review": ["Requires Approval", "Submitted"],
      "Requires Approval": ["Ready to Print", "Under Review"],
      "Requested Changes": ["Under Review", "Requires Approval"],
      "Ready to Print": ["Printing", "Requires Approval"],
      Printing: ["Completed", "Ready to Print"],
      Completed: ["Printing"],
    };

    const bakerAllowedTransitions = {
      Draft: ["Submitted"],
      Submitted: [],
      "Under Review": [],
      "Requires Approval": ["Ready to Print", "Requested Changes"],
      "Requested Changes": ["Submitted"],
      "Ready to Print": [],
      Printing: [],
      Completed: [],
    };

    let allowedTransitions = [];
    if (isAdmin) {
      allowedTransitions = adminAllowedTransitions[currentStage] || [];
    } else if (isBaker) {
      // Baker can only modify their own orders
      if (order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      allowedTransitions = bakerAllowedTransitions[currentStage] || [];
    }

    if (!allowedTransitions.includes(stage)) {
      return res.status(400).json({
        message: `Cannot transition from ${currentStage} to ${stage}. Allowed transitions: ${allowedTransitions.join(
          ", "
        )}`,
      });
    }

    // Special validations
    if (stage === "Requires Approval" && (!price || price <= 0)) {
      return res.status(400).json({
        message: "Price is required when setting order to Requires Approval",
      });
    }

    // Baker-specific validation: Must have inspiration images before submitting
    if (isBaker && currentStage === "Draft" && stage === "Submitted") {
      const itemsWithoutImages = order.items.filter(
        (item) => !item.inspirationImages || item.inspirationImages.length === 0
      );

      if (itemsWithoutImages.length > 0) {
        return res.status(400).json({
          message: `Cannot submit order: ${itemsWithoutImages.length} item(s) are missing inspiration images. Please upload at least one inspiration image for each item before submitting.`,
          missingImages: itemsWithoutImages.length,
          totalItems: order.items.length,
        });
      }
    }

    // Update order
    order._changedBy = req.user._id;
    order._stageComments = comments || "";
    order.stage = stage;

    if (price && stage === "Requires Approval") {
      order.price = price;
    }

    await order.save();

    console.log("📋 Order stage changed:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      fromStage: currentStage,
      toStage: stage,
      changedBy: req.user.email,
      price: order.price,
    });

    // Send email notification to baker (only when stage actually changes)
    if (currentStage !== stage) {
      await sendOrderStageChangeEmail(
        order.bakerEmail,
        order.orderNumber,
        stage,
        comments
      );
    }

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "stage_changed",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Order stage updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order stage:", error);
    res.status(500).json({ message: "Server error updating order stage" });
  }
});

// Add item to order (Baker only, draft orders only)
router.post("/:id/items", async (req, res) => {
  try {
    if (req.user.role !== "baker") {
      return res.status(403).json({ message: "Only bakers can add items" });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.bakerId !== req.user.bakerId) {
      return res.status(403).json({ message: "Access denied to this order" });
    }

    if (order.stage !== "Draft") {
      return res
        .status(403)
        .json({ message: "Can only add items to draft orders" });
    }

    const { type, measurement, additionalComments } = req.body;

    if (!type || !["Cutter", "Stamp", "Stamp & Cutter"].includes(type)) {
      return res.status(400).json({ message: "Valid item type is required" });
    }

    // Validate measurement
    if (!measurement || !measurement.value || measurement.value <= 0) {
      return res.status(400).json({ message: "Valid measurement is required" });
    }

    if (!measurement.unit || !["cm", "mm"].includes(measurement.unit)) {
      return res
        .status(400)
        .json({ message: "Valid measurement unit is required" });
    }

    const newItem = {
      type,
      measurement: {
        value: measurement.value,
        unit: measurement.unit,
      },
      additionalComments: additionalComments || "",
      inspirationImages: [],
      previewImages: [],
    };

    order.items.push(newItem);
    await order.save();

    console.log("📋 Item added to order:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemType: type,
      measurement: measurement,
      totalItems: order.items.length,
      addedBy: req.user.email,
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "item_added",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Item added successfully",
      order,
    });
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Server error adding item" });
  }
});

// Update item in order
router.put("/:id/items/:itemId", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (req.user.role === "baker") {
      if (order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      if (order.stage !== "Draft") {
        return res
          .status(403)
          .json({ message: "Can only edit items in draft orders" });
      }
    }

    const item = order.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const { type, measurement, additionalComments } = req.body;

    // Store original values for logging
    const originalItem = {
      type: item.type,
      measurement: item.measurement,
      comments: item.additionalComments,
    };

    if (type) {
      if (!["Cutter", "Stamp", "Stamp & Cutter"].includes(type)) {
        return res.status(400).json({ message: "Invalid item type" });
      }
      item.type = type;
    }

    if (measurement) {
      // Validate measurement
      if (!measurement.value || measurement.value <= 0) {
        return res
          .status(400)
          .json({ message: "Valid measurement value is required" });
      }

      if (!measurement.unit || !["cm", "mm"].includes(measurement.unit)) {
        return res
          .status(400)
          .json({ message: "Valid measurement unit is required" });
      }

      item.measurement = {
        value: measurement.value,
        unit: measurement.unit,
      };
    }

    if (additionalComments !== undefined) {
      item.additionalComments = additionalComments;
    }

    await order.save();

    console.log("📋 Item updated in order:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemId: req.params.itemId,
      updatedBy: req.user.email,
      changes: {
        typeChanged: originalItem.type !== item.type,
        measurementChanged:
          JSON.stringify(originalItem.measurement) !==
          JSON.stringify(item.measurement),
        commentsChanged: originalItem.comments !== item.additionalComments,
      },
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "item_updated",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Item updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ message: "Server error updating item" });
  }
});

// Delete item from order
router.delete("/:id/items/:itemId", requireBakerOrAdmin, async (req, res) => {
  try {
    console.log("🗑️ Delete item request received:", {
      orderId: req.params.id,
      itemId: req.params.itemId,
      userRole: req.user.role,
      userEmail: req.user.email,
    });

    const order = await Order.findById(req.params.id);

    if (!order) {
      console.log("❌ Order not found:", req.params.id);
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (req.user.role === "baker") {
      if (order.bakerId !== req.user.bakerId) {
        console.log("❌ Access denied - baker doesn't own order");
        return res.status(403).json({ message: "Access denied to this order" });
      }
      if (order.stage !== "Draft") {
        console.log("❌ Cannot delete from non-draft order:", order.stage);
        return res
          .status(403)
          .json({ message: "Can only delete items from draft orders" });
      }
    }

    const item = order.items.id(req.params.itemId);
    if (!item) {
      console.log("❌ Item not found:", req.params.itemId);
      return res.status(404).json({ message: "Item not found" });
    }

    // Store item info for logging
    const deletedItemInfo = {
      type: item.type,
      measurement: item.measurement,
      comments: item.additionalComments,
      inspirationImagesCount: item.inspirationImages?.length || 0,
      previewImagesCount: item.previewImages?.length || 0,
    };

    console.log("🔍 Item to delete:", deletedItemInfo);

    // TODO: Delete associated images from S3 before removing item
    // This would require implementing image cleanup functionality

    // Remove the item using the pull method
    order.items.pull(req.params.itemId);
    await order.save();

    console.log("✅ Item deleted from order:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemId: req.params.itemId,
      deletedBy: req.user.email,
      deletedItem: deletedItemInfo,
      remainingItems: order.items.length,
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "item_deleted",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Item deleted successfully",
      order,
    });
  } catch (error) {
    console.error("❌ Error deleting item:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      message: "Server error deleting item",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Delete entire order
router.delete("/:id", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check permissions
    if (req.user.role === "baker") {
      if (order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      if (order.stage !== "Draft") {
        return res
          .status(403)
          .json({ message: "Can only delete draft orders" });
      }
    }

    // Store order info for logging and real-time updates
    const deletedOrderInfo = {
      _id: order._id,
      orderNumber: order.orderNumber,
      bakerId: order.bakerId,
      bakerEmail: order.bakerEmail,
      stage: order.stage,
      itemsCount: order.items.length,
      createdAt: order.createdAt,
    };

    console.log("📋 Order deletion initiated:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      deletedBy: req.user.email,
      userRole: req.user.role,
      orderStage: order.stage,
      itemsCount: order.items.length,
    });

    // TODO: Delete all associated images from S3 before deleting order
    // This would require implementing bulk image cleanup functionality

    await Order.findByIdAndDelete(req.params.id);

    console.log("✅ Order deleted successfully:", {
      orderId: deletedOrderInfo._id,
      orderNumber: deletedOrderInfo.orderNumber,
      deletedBy: req.user.email,
    });

    // Emit real-time update BEFORE sending response
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        deletedOrderInfo._id,
        deletedOrderInfo,
        "deleted",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Order deleted successfully",
      deletedOrder: {
        _id: deletedOrderInfo._id,
        orderNumber: deletedOrderInfo.orderNumber,
      },
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Server error deleting order" });
  }
});

// Update post-completion details (delivery method and payment method)
router.put("/:id/completion", async (req, res) => {
  try {
    if (req.user.role !== "baker") {
      return res
        .status(403)
        .json({ message: "Only bakers can update completion details" });
    }

    const { deliveryMethod, paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.bakerId !== req.user.bakerId) {
      return res.status(403).json({ message: "Access denied to this order" });
    }

    if (order.stage !== "Completed") {
      return res.status(400).json({
        message: "Can only update completion details for completed orders",
      });
    }

    if (!deliveryMethod || !["Pickup", "Delivery"].includes(deliveryMethod)) {
      return res
        .status(400)
        .json({ message: "Valid delivery method is required" });
    }

    if (!paymentMethod || !["Cash", "Card"].includes(paymentMethod)) {
      return res
        .status(400)
        .json({ message: "Valid payment method is required" });
    }

    // Store original values for logging
    const originalCompletion = {
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
    };

    order.deliveryMethod = deliveryMethod;
    order.paymentMethod = paymentMethod;
    await order.save();

    console.log("📋 Order completion details updated:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      updatedBy: req.user.email,
      changes: {
        deliveryMethod: `${originalCompletion.deliveryMethod} → ${deliveryMethod}`,
        paymentMethod: `${originalCompletion.paymentMethod} → ${paymentMethod}`,
      },
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "completion_updated",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Completion details updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating completion details:", error);
    res
      .status(500)
      .json({ message: "Server error updating completion details" });
  }
});

// Get order statistics (Admin only)
router.get("/stats/overview", requireAdmin, async (req, res) => {
  try {
    // Enhanced statistics with baker email filtering support
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$stage",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ stage: "Completed" });
    const activeOrders = await Order.countDocuments({
      stage: { $nin: ["Completed", "Draft"] },
    });

    // Additional stats for baker activity
    const bakerStats = await Order.aggregate([
      {
        $group: {
          _id: "$bakerEmail",
          orderCount: { $sum: 1 },
          bakerId: { $first: "$bakerId" },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
      {
        $sort: { orderCount: -1 },
      },
      {
        $limit: 10, // Top 10 most active bakers
      },
    ]);

    res.json({
      totalOrders,
      completedOrders,
      activeOrders,
      stageBreakdown: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      topBakers: bakerStats,
    });
  } catch (error) {
    console.error("Error fetching order statistics:", error);
    res.status(500).json({ message: "Server error fetching statistics" });
  }
});

module.exports = router;
