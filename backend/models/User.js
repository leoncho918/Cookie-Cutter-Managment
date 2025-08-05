// models/User.js - Enhanced User model with name and phone fields
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ["admin", "baker"],
    required: true,
  },
  // New personal information fields
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        // Basic phone number validation - allows various formats
        return /^[\+]?[\d\s\-\(\)]{10,15}$/.test(v);
      },
      message: "Please enter a valid phone number",
    },
  },
  bakerId: {
    type: String,
    unique: true,
    sparse: true, // Only required for bakers
    uppercase: true,
  },
  isFirstLogin: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamp on save
userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Generate baker ID for new bakers
userSchema.pre("save", async function (next) {
  if (this.role === "baker" && !this.bakerId) {
    // Generate a unique baker ID (e.g., B001, B002, etc.)
    const lastBaker = await this.constructor.findOne(
      { role: "baker" },
      {},
      { sort: { createdAt: -1 } }
    );

    let nextNumber = 1;
    if (lastBaker && lastBaker.bakerId) {
      const lastNumber = parseInt(lastBaker.bakerId.substring(1));
      nextNumber = lastNumber + 1;
    }

    this.bakerId = `B${nextNumber.toString().padStart(3, "0")}`;
  }
  next();
});

// Method to get display name
userSchema.methods.getDisplayName = function () {
  return `${this.firstName} ${this.lastName}${
    this.bakerId ? ` (${this.bakerId})` : ""
  }`;
};

// Method to format phone number for display
userSchema.methods.getFormattedPhone = function () {
  // Basic formatting - can be enhanced based on requirements
  const cleaned = this.phoneNumber.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(
      3,
      6
    )}-${cleaned.substring(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(
      4,
      7
    )}-${cleaned.substring(7)}`;
  }
  return this.phoneNumber; // Return original if can't format
};

// Static method to validate phone number
userSchema.statics.validatePhoneNumber = function (phoneNumber) {
  const cleaned = phoneNumber.replace(/\D/g, "");

  if (cleaned.length < 10 || cleaned.length > 15) {
    return {
      valid: false,
      message: "Phone number must be between 10-15 digits",
    };
  }

  // Additional validation can be added here
  return { valid: true };
};

// Index for search optimization
userSchema.index({ email: 1 });
userSchema.index({ bakerId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ firstName: 1, lastName: 1 });

module.exports = mongoose.model("User", userSchema);
