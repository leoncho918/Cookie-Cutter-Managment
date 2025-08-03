// models/User.js - User model for both Admin and Baker roles
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

module.exports = mongoose.model("User", userSchema);
