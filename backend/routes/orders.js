// routes/orders.js - Enhanced with ALL FILTER SUPPORT including pickup date filters
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

// UPDATED: Get all orders (with COMPLETE filtering support including pickup date filters)
router.get("/", requireBakerOrAdmin, async (req, res) => {
  try {
    let query = {};

    // If user is baker, only show their orders
    if (req.user.role === "baker") {
      query.bakerId = req.user.bakerId;
    }

    // Apply filters from query parameters
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
    } = req.query;

    // Basic filters
    if (stage) query.stage = stage;
    if (bakerId && req.user.role === "admin") query.bakerId = bakerId;

    // Baker email filtering (admin only)
    if (bakerEmail && req.user.role === "admin") {
      query.bakerEmail = { $regex: new RegExp(bakerEmail, "i") }; // Case-insensitive search
    }

    // Date required filtering (original due date filters)
    if (dateFrom || dateTo) {
      query.dateRequired = {};
      if (dateFrom) query.dateRequired.$gte = new Date(dateFrom);
      if (dateTo) query.dateRequired.$lte = new Date(dateTo);
    }

    // NEW: Delivery method filtering
    if (deliveryMethod) {
      query.deliveryMethod = deliveryMethod;
    }

    // NEW: Payment method filtering
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // NEW: Pickup-specific filtering
    if (pickupStatus || pickupDateFrom || pickupDateTo) {
      // Ensure we're only filtering pickup orders
      query.deliveryMethod = "Pickup";

      // Add pickup schedule existence check
      query.pickupSchedule = { $exists: true, $ne: null };
      query["pickupSchedule.date"] = { $exists: true, $ne: null };

      // Handle pickup date range filtering
      if (pickupDateFrom || pickupDateTo) {
        query["pickupSchedule.date"] = {};

        if (pickupDateFrom) {
          // Create start of day for the from date
          const fromDate = new Date(pickupDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          query["pickupSchedule.date"].$gte = fromDate;
        }

        if (pickupDateTo) {
          // Create end of day for the to date
          const toDate = new Date(pickupDateTo);
          toDate.setHours(23, 59, 59, 999);
          query["pickupSchedule.date"].$lte = toDate;
        }
      }

      // Handle pickup status filtering (today, overdue, tomorrow, upcoming)
      if (pickupStatus) {
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
            // For overdue, we need to check if the pickup datetime has passed
            // This requires a more complex query using $expr
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
            // For upcoming, pickup datetime is in the future
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
            // Calculate start and end of current week
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
    }

    console.log("📋 Orders query with ALL filters:", {
      query: JSON.stringify(query, null, 2),
      userRole: req.user.role,
      userId: req.user._id,
      filters: {
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
      },
    });

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("stageHistory.changedBy", "email bakerId");

    console.log("✅ Orders found with filters:", {
      count: orders.length,
      filterApplied: Object.keys(req.query).length > 0,
      appliedFilters: Object.keys(req.query).filter((key) => req.query[key]),
    });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders with filters:", error);
    res.status(500).json({
      message: "Server error fetching orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ... (keep all your other existing routes unchanged - only replace the GET "/" route above)

module.exports = router;
