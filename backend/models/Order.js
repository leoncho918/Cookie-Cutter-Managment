// models/Order.js - Order model with measurement property added
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
    dimension: {
      type: String,
      enum: ["length", "width", "diameter"],
      required: true,
      default: "length",
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
