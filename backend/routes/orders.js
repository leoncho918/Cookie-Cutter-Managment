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

// Export router (rest of the routes stay unchanged below)
module.exports = router;
