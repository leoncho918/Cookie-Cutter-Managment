// models/Order.js - Enhanced Order model with delivery address support
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Cutter", "Stamp", "Stamp & Cutter"],
    required: true,
  },
  measurement: {
    value: {
      type: Number,
      required: true,
      min: 0.1,
      max: 1000, // Maximum 1000cm/mm
    },
    unit: {
      type: String,
      enum: ["cm", "mm"],
      required: true,
      default: "cm",
    },
  },
  inspirationImages: [
    {
      url: String,
      key: String, // S3 key for deletion
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
  previewImages: [
    {
      url: String,
      key: String, // S3 key for deletion
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
  additionalComments: {
    type: String,
    maxlength: 1000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
  },
  bakerId: {
    type: String,
    required: true,
    ref: "User",
  },
  bakerEmail: {
    type: String,
    required: true,
  },
  dateRequired: {
    type: Date,
    required: true,
  },
  stage: {
    type: String,
    enum: [
      "Draft",
      "Submitted",
      "Under Review",
      "Requires Approval",
      "Requested Changes",
      "Ready to Print",
      "Printing",
      "Completed",
      "Delivered", // NEW STAGE
    ],
    default: "Draft",
  },
  items: [itemSchema],
  price: {
    type: Number,
    min: 0,
  },
  // Post-completion fields
  deliveryMethod: {
    type: String,
    enum: ["Pickup", "Delivery"],
  },
  paymentMethod: {
    type: String,
    enum: ["Cash", "Card"],
  },
  // NEW: Confirmation tracking for collection and payment details
  detailsConfirmed: {
    type: Boolean,
    default: false,
  },
  detailsConfirmedAt: {
    type: Date,
  },
  detailsConfirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // Add after the existing completion-related fields
  updateRequest: {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedAt: Date,
    requestedChanges: {
      deliveryMethod: String,
      paymentMethod: String,
      pickupSchedule: {
        date: String,
        time: String,
        notes: String,
      },
      deliveryAddress: {
        street: String,
        suburb: String,
        state: String,
        postcode: String,
        country: String,
        instructions: String,
      },
    },
    reason: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminResponse: String,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    respondedAt: Date,
  },
  // Pickup scheduling for when deliveryMethod is "Pickup"
  pickupSchedule: {
    date: {
      type: Date,
    },
    time: {
      type: String, // Store time as "HH:MM" format
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  // NEW: Delivery address for when deliveryMethod is "Delivery"
  deliveryAddress: {
    street: {
      type: String,
      maxlength: 200,
    },
    suburb: {
      type: String,
      maxlength: 100,
    },
    state: {
      type: String,
      maxlength: 100, // Increased for international states/provinces
    },
    postcode: {
      type: String,
      maxlength: 20, // Increased for international postal codes
    },
    country: {
      type: String,
      maxlength: 100,
      default: "Australia",
    },
    instructions: {
      type: String,
      maxlength: 500,
    },
  },
  // Order tracking
  stageHistory: [
    {
      stage: String,
      changedBy: String, // User ID
      changedAt: { type: Date, default: Date.now },
      comments: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate order number before saving
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber && this.isNew) {
    try {
      // Find the last order for this baker
      const lastOrder = await this.constructor.findOne(
        { bakerId: this.bakerId },
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

      this.orderNumber = `${this.bakerId}-${nextNumber
        .toString()
        .padStart(3, "0")}`;
    } catch (error) {
      console.error("Error generating order number:", error);
      // Fallback: generate a timestamp-based order number
      this.orderNumber = `${this.bakerId}-${Date.now().toString().slice(-6)}`;
    }
  }

  this.updatedAt = new Date();
  next();
});

// Track stage changes
orderSchema.pre("save", function (next) {
  if (this.isModified("stage") && !this.isNew) {
    this.stageHistory.push({
      stage: this.stage,
      changedBy: this._changedBy || "system", // Set this in the route handler
      comments: this._stageComments || "",
    });
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
