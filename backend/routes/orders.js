// routes/orders.js - Fully Merged: All Filters + Baker Editing Permissions
const express = require("express");
const Order = require("../models/Order");
const { requireAdmin, requireBakerOrAdmin } = require("../middleware/auth");
const { sendOrderStageChangeEmail } = require("../utils/email");
const { emitOrderUpdate } = require("../utils/socketUtils");

const router = express.Router();

// Helper function to check if baker can edit order
const canBakerEditOrder = (order, user) => {
  return (
    user.role === "baker" &&
    order.bakerId === user.bakerId &&
    (order.stage === "Draft" || order.stage === "Requested Changes")
  );
};

// Helper function to check editing permissions
const canEditOrder = (order, user) => {
  return user.role === "admin" || canBakerEditOrder(order, user);
};

// Merged GET / with ALL filter support and full permission logic
router.get("/", requireBakerOrAdmin, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "baker") {
      query.bakerId = req.user.bakerId;
    }

    const {
      stage,
      bakerId,
      bakerEmail,
      dateFrom,
      dateTo,
      deliveryMethod,
      paymentMethod,
      pickupStatus,
      pickupDateFrom,
      pickupDateTo,
      pendingUpdates, // Add this line
    } = req.query;

    if (stage) query.stage = stage;
    if (bakerId && req.user.role === "admin") query.bakerId = bakerId;

    if (bakerEmail && req.user.role === "admin") {
      query.bakerEmail = { $regex: new RegExp(bakerEmail, "i") };
    }

    if (dateFrom || dateTo) {
      query.dateRequired = {};
      if (dateFrom) query.dateRequired.$gte = new Date(dateFrom);
      if (dateTo) query.dateRequired.$lte = new Date(dateTo);
    }

    // Add this new section here
    if (pendingUpdates === "true") {
      query["updateRequest.status"] = "pending";
    }

    if (deliveryMethod) query.deliveryMethod = deliveryMethod;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (pickupStatus || pickupDateFrom || pickupDateTo) {
      query.deliveryMethod = "Pickup";
      query.pickupSchedule = { $exists: true, $ne: null };
      query["pickupSchedule.date"] = { $exists: true, $ne: null };

      if (pickupDateFrom || pickupDateTo) {
        query["pickupSchedule.date"] = {};
        if (pickupDateFrom) {
          const fromDate = new Date(pickupDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          query["pickupSchedule.date"].$gte = fromDate;
        }
        if (pickupDateTo) {
          const toDate = new Date(pickupDateTo);
          toDate.setHours(23, 59, 59, 999);
          query["pickupSchedule.date"].$lte = toDate;
        }
      }

      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      switch (pickupStatus) {
        case "today":
          query["pickupSchedule.date"] = {
            $gte: today,
            $lte: endOfToday,
          };
          break;
        case "tomorrow":
          const endOfTomorrow = new Date(tomorrow);
          endOfTomorrow.setHours(23, 59, 59, 999);
          query["pickupSchedule.date"] = {
            $gte: tomorrow,
            $lte: endOfTomorrow,
          };
          break;
        case "overdue":
          query.$expr = {
            $lt: [
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      {
                        $dateToString: {
                          format: "%Y-%m-%d",
                          date: "$pickupSchedule.date",
                        },
                      },
                      "T",
                      "$pickupSchedule.time",
                    ],
                  },
                },
              },
              now,
            ],
          };
          break;
        case "upcoming":
          query.$expr = {
            $gt: [
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      {
                        $dateToString: {
                          format: "%Y-%m-%d",
                          date: "$pickupSchedule.date",
                        },
                      },
                      "T",
                      "$pickupSchedule.time",
                    ],
                  },
                },
              },
              now,
            ],
          };
          break;
        case "this-week":
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          query["pickupSchedule.date"] = {
            $gte: startOfWeek,
            $lte: endOfWeek,
          };
          break;
      }
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("stageHistory.changedBy", "email bakerId");

    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders with filters:", error);
    res.status(500).json({
      message: "Server error fetching orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
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

// Enhanced update order - supports baker editing in Draft and Requested Changes stages
router.put("/:id", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Enhanced permission checking
    if (!canEditOrder(order, req.user)) {
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          return res
            .status(403)
            .json({ message: "Access denied to this order" });
        }
        return res.status(403).json({
          message: "Can only edit orders in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
      }
      return res.status(403).json({ message: "Access denied" });
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
      userRole: req.user.role,
      orderStage: order.stage,
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

// Enhanced add item - supports baker adding in Draft and Requested Changes stages
router.post("/:id/items", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Enhanced permission checking
    if (!canEditOrder(order, req.user)) {
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          return res
            .status(403)
            .json({ message: "Access denied to this order" });
        }
        return res.status(403).json({
          message: "Can only add items in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
      }
      return res.status(403).json({ message: "Access denied" });
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
      orderStage: order.stage,
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

// Enhanced update item - supports baker editing in Draft and Requested Changes stages
router.put("/:id/items/:itemId", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Enhanced permission checking
    if (!canEditOrder(order, req.user)) {
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          return res
            .status(403)
            .json({ message: "Access denied to this order" });
        }
        return res.status(403).json({
          message: "Can only edit items in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
      }
      return res.status(403).json({ message: "Access denied" });
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
      orderStage: order.stage,
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

// Enhanced delete item - supports baker deleting in Draft and Requested Changes stages
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

    // Enhanced permission checking
    if (!canEditOrder(order, req.user)) {
      if (req.user.role === "baker") {
        if (order.bakerId !== req.user.bakerId) {
          console.log("❌ Access denied - baker doesn't own order");
          return res
            .status(403)
            .json({ message: "Access denied to this order" });
        }
        console.log("❌ Cannot delete from order in stage:", order.stage);
        return res.status(403).json({
          message: "Can only delete items in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
      }
      return res.status(403).json({ message: "Access denied" });
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
      orderStage: order.stage,
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

// Enhanced delete entire order - supports baker deleting in Draft and Requested Changes stages
router.delete("/:id", requireBakerOrAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Enhanced permission checking for order deletion
    if (req.user.role === "baker") {
      if (order.bakerId !== req.user.bakerId) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      // Bakers can delete in Draft or Requested Changes stages
      if (order.stage !== "Draft" && order.stage !== "Requested Changes") {
        return res.status(403).json({
          message:
            "Can only delete orders in Draft or Requested Changes stages",
          currentStage: order.stage,
          allowedStages: ["Draft", "Requested Changes"],
        });
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
    if (req.user.role !== "baker" && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only bakers and admins can update completion details",
      });
    }
    const { deliveryMethod, paymentMethod, pickupSchedule, deliveryAddress } =
      req.body;

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

    if (req.user.role === "baker") {
      // NEW: Check if details are already confirmed
      if (order.detailsConfirmed) {
        // If details are confirmed, baker needs admin approval to update
        if (order.updateRequest && order.updateRequest.status === "approved") {
          console.log("Baker updating with approved request");
        } else {
          return res.status(403).json({
            message:
              "Details are already confirmed. Please request changes through admin.",
            requiresRequest: true,
            detailsConfirmed: true,
          });
        }
      } else if (
        order.updateRequest &&
        order.updateRequest.status === "approved"
      ) {
        // Baker can update because admin approved their request
        console.log("Baker updating with approved request");
      } else if (!order.deliveryMethod && !order.paymentMethod) {
        // First time setting details - allow direct update
        console.log("Baker setting initial completion details");
      } else {
        // Baker trying to update existing unconfirmed details - this is allowed
        console.log("Baker updating unconfirmed completion details");
      }
    }

    // Validate delivery method
    if (!deliveryMethod || !["Pickup", "Delivery"].includes(deliveryMethod)) {
      return res
        .status(400)
        .json({ message: "Valid delivery method is required" });
    }

    // Validate payment method
    if (!paymentMethod || !["Cash", "Card"].includes(paymentMethod)) {
      return res
        .status(400)
        .json({ message: "Valid payment method is required" });
    }

    // Validate pickup schedule if delivery method is Pickup
    if (deliveryMethod === "Pickup") {
      if (!pickupSchedule || !pickupSchedule.date || !pickupSchedule.time) {
        return res.status(400).json({
          message:
            "Pickup date and time are required when delivery method is Pickup",
        });
      }

      // Validate pickup date is not in the past
      const pickupDateTime = new Date(
        `${pickupSchedule.date}T${pickupSchedule.time}`
      );
      const now = new Date();

      if (pickupDateTime < now) {
        return res.status(400).json({
          message: "Pickup date and time cannot be in the past",
        });
      }

      // Validate notes length if provided
      if (pickupSchedule.notes && pickupSchedule.notes.length > 500) {
        return res.status(400).json({
          message: "Pickup notes cannot exceed 500 characters",
        });
      }
    }

    // Validate delivery address if delivery method is Delivery
    if (deliveryMethod === "Delivery") {
      if (
        !deliveryAddress ||
        !deliveryAddress.street ||
        !deliveryAddress.suburb ||
        !deliveryAddress.state ||
        !deliveryAddress.postcode ||
        !deliveryAddress.country
      ) {
        return res.status(400).json({
          message:
            "Complete delivery address including country is required when delivery method is Delivery",
        });
      }

      // Validate address field lengths
      if (deliveryAddress.street && deliveryAddress.street.length > 200) {
        return res.status(400).json({
          message: "Street address cannot exceed 200 characters",
        });
      }

      if (deliveryAddress.suburb && deliveryAddress.suburb.length > 100) {
        return res.status(400).json({
          message: "Suburb/City cannot exceed 100 characters",
        });
      }

      if (deliveryAddress.state && deliveryAddress.state.length > 100) {
        return res.status(400).json({
          message: "State/Province cannot exceed 100 characters",
        });
      }

      if (deliveryAddress.postcode && deliveryAddress.postcode.length > 20) {
        return res.status(400).json({
          message: "Postal code cannot exceed 20 characters",
        });
      }

      if (deliveryAddress.country && deliveryAddress.country.length > 100) {
        return res.status(400).json({
          message: "Country cannot exceed 100 characters",
        });
      }

      if (
        deliveryAddress.instructions &&
        deliveryAddress.instructions.length > 500
      ) {
        return res.status(400).json({
          message: "Delivery instructions cannot exceed 500 characters",
        });
      }

      // Country-specific postcode validation
      if (deliveryAddress.country === "Australia") {
        const postcodeRegex = /^[0-9]{4}$/;
        if (!postcodeRegex.test(deliveryAddress.postcode)) {
          return res.status(400).json({
            message: "Australian postcode must be 4 digits",
          });
        }
      } else if (
        deliveryAddress.country === "United States" ||
        deliveryAddress.country === "USA"
      ) {
        const postcodeRegex = /^[0-9]{5}(-[0-9]{4})?$/;
        if (!postcodeRegex.test(deliveryAddress.postcode)) {
          return res.status(400).json({
            message: "US ZIP code must be in format 12345 or 12345-6789",
          });
        }
      } else if (deliveryAddress.country === "Canada") {
        const postcodeRegex = /^[A-Z][0-9][A-Z] [0-9][A-Z][0-9]$/i;
        if (!postcodeRegex.test(deliveryAddress.postcode)) {
          return res.status(400).json({
            message: "Canadian postal code must be in format A1A 1A1",
          });
        }
      } else if (
        deliveryAddress.country === "United Kingdom" ||
        deliveryAddress.country === "UK"
      ) {
        const postcodeRegex = /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i;
        if (!postcodeRegex.test(deliveryAddress.postcode)) {
          return res.status(400).json({
            message: "UK postcode must be in valid format (e.g., SW1A 1AA)",
          });
        }
      }
      // For other countries, we'll accept any format but ensure it's not empty
    }

    // Store original values for logging
    const originalCompletion = {
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
      pickupSchedule: order.pickupSchedule,
      deliveryAddress: order.deliveryAddress,
    };

    // Update completion details
    order.deliveryMethod = deliveryMethod;
    order.paymentMethod = paymentMethod;

    // Update pickup schedule if delivery method is Pickup
    if (deliveryMethod === "Pickup") {
      order.pickupSchedule = {
        date: new Date(pickupSchedule.date),
        time: pickupSchedule.time,
        notes: pickupSchedule.notes || "",
      };
      // Clear delivery address if switching to pickup
      order.deliveryAddress = undefined;
    }

    // Update delivery address if delivery method is Delivery
    if (deliveryMethod === "Delivery") {
      order.deliveryAddress = {
        street: deliveryAddress.street.trim(),
        suburb: deliveryAddress.suburb.trim(),
        state: deliveryAddress.state.trim(),
        postcode: deliveryAddress.postcode.trim(),
        country: deliveryAddress.country
          ? deliveryAddress.country.trim()
          : "Australia",
        instructions: deliveryAddress.instructions
          ? deliveryAddress.instructions.trim()
          : "",
      };
      // Clear pickup schedule if switching to delivery
      order.pickupSchedule = undefined;
    }

    await order.save();

    // NEW: Reset confirmation if admin is updating or if update request was approved
    if (
      req.user.role === "admin" ||
      (order.updateRequest && order.updateRequest.status === "approved")
    ) {
      order.detailsConfirmed = false;
      order.detailsConfirmedAt = undefined;
      order.detailsConfirmedBy = undefined;

      // Clear the approved update request
      if (order.updateRequest && order.updateRequest.status === "approved") {
        order.updateRequest = undefined;
      }
    }

    console.log("📋 Order completion details updated:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      updatedBy: req.user.email,
      deliveryMethod: deliveryMethod,
      paymentMethod: paymentMethod,
      hasPickupSchedule: deliveryMethod === "Pickup" && !!pickupSchedule,
      hasDeliveryAddress: deliveryMethod === "Delivery" && !!deliveryAddress,
      changes: {
        deliveryMethod: `${originalCompletion.deliveryMethod} → ${deliveryMethod}`,
        paymentMethod: `${originalCompletion.paymentMethod} → ${paymentMethod}`,
        addressProvided: deliveryMethod === "Delivery" ? "Yes" : "N/A",
        pickupScheduled:
          deliveryMethod === "Pickup"
            ? `${pickupSchedule.date} at ${pickupSchedule.time}`
            : "N/A",
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
      requiresConfirmation:
        !order.detailsConfirmed && req.user.role === "baker",
    });
  } catch (error) {
    console.error("Error updating completion details:", error);
    res
      .status(500)
      .json({ message: "Server error updating completion details" });
  }
});

// NEW: Confirm completion details (baker only)
router.put("/:id/completion/confirm", async (req, res) => {
  try {
    if (req.user.role !== "baker") {
      return res.status(403).json({
        message: "Only bakers can confirm completion details",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.bakerId !== req.user.bakerId) {
      return res.status(403).json({ message: "Access denied to this order" });
    }

    if (order.stage !== "Completed") {
      return res.status(400).json({
        message: "Can only confirm details for completed orders",
      });
    }

    if (order.detailsConfirmed) {
      return res.status(400).json({
        message: "Completion details are already confirmed",
      });
    }

    // Validate that all required details are present
    if (!order.deliveryMethod || !order.paymentMethod) {
      return res.status(400).json({
        message:
          "Collection and payment details must be set before confirmation",
      });
    }

    // Additional validation based on delivery method
    if (order.deliveryMethod === "Pickup" && !order.pickupSchedule) {
      return res.status(400).json({
        message: "Pickup schedule must be set before confirmation",
      });
    }

    if (order.deliveryMethod === "Delivery" && !order.deliveryAddress) {
      return res.status(400).json({
        message: "Delivery address must be set before confirmation",
      });
    }

    // Confirm the details
    order.detailsConfirmed = true;
    order.detailsConfirmedAt = new Date();
    order.detailsConfirmedBy = req.user._id;

    await order.save();

    console.log("✅ Order completion details confirmed:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      confirmedBy: req.user.email,
      confirmedAt: order.detailsConfirmedAt,
      deliveryMethod: order.deliveryMethod,
      paymentMethod: order.paymentMethod,
    });

    // Send confirmation email
    const { sendCompletionDetailsConfirmedEmail } = require("../utils/email");
    await sendCompletionDetailsConfirmedEmail(
      order.bakerEmail,
      order.orderNumber,
      order.deliveryMethod,
      order.paymentMethod,
      order.pickupSchedule,
      order.deliveryAddress
    );

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "completion_confirmed",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Completion details confirmed successfully",
      order,
    });
  } catch (error) {
    console.error("Error confirming completion details:", error);
    res
      .status(500)
      .json({ message: "Server error confirming completion details" });
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

// Request completion details update (Baker only)
router.post("/:id/request-completion-update", async (req, res) => {
  try {
    if (!order.detailsConfirmed) {
      return res.status(400).json({
        message: "Please confirm your details first before requesting updates",
        requiresConfirmation: true,
      });
    }

    if (req.user.role !== "baker") {
      return res
        .status(403)
        .json({ message: "Only bakers can request updates" });
    }

    const { requestedChanges, reason } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.bakerId !== req.user.bakerId) {
      return res.status(403).json({ message: "Access denied to this order" });
    }

    if (order.stage !== "Completed") {
      return res.status(400).json({
        message: "Can only request updates for completed orders",
      });
    }

    // Store the update request
    order.updateRequest = {
      requestedBy: req.user._id,
      requestedAt: new Date(),
      requestedChanges,
      reason,
      status: "pending",
    };

    await order.save();

    console.log("📋 Update request created:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      requestedBy: req.user.email,
      reason: reason,
    });

    // Send email notification to admin
    await sendUpdateRequestNotification(
      order.bakerEmail,
      order.orderNumber,
      reason
    );

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        "update_requested",
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: "Update request sent to admin successfully",
      order,
    });
  } catch (error) {
    console.error("Error creating update request:", error);
    res.status(500).json({ message: "Server error creating update request" });
  }
});

// Admin approve/reject update request
router.put("/:id/update-request/:action", requireAdmin, async (req, res) => {
  try {
    const { action } = req.params; // 'approve' or 'reject'
    const { adminResponse } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.updateRequest || order.updateRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "No pending update request found" });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    // Update the request status
    order.updateRequest.status = action === "approve" ? "approved" : "rejected";
    order.updateRequest.adminResponse = adminResponse || "";
    order.updateRequest.respondedBy = req.user._id;
    order.updateRequest.respondedAt = new Date();

    if (action === "approve") {
      order.detailsConfirmed = false;
      order.detailsConfirmedAt = undefined;
      order.detailsConfirmedBy = undefined;
    }

    await order.save();

    console.log("📋 Update request responded:", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      action: action,
      respondedBy: req.user.email,
    });

    // Send email notification to baker
    await sendUpdateRequestResponseEmail(
      order.bakerEmail,
      order.orderNumber,
      action,
      adminResponse
    );

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      emitOrderUpdate(
        io,
        order._id,
        order,
        `update_request_${action}d`,
        req.user._id,
        req.user.email
      );
    }

    res.json({
      message: `Update request ${action}d successfully`,
      order,
    });
  } catch (error) {
    console.error("Error responding to update request:", error);
    res
      .status(500)
      .json({ message: "Server error responding to update request" });
  }
});

module.exports = router;
