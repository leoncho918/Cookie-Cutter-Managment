// routes/users.js - User management routes
const express = require("express");
const User = require("../models/User");
const {
  generateRandomPassword,
  sendAccountCreationEmail,
} = require("../utils/email");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get all bakers (Admin only)
router.get("/bakers", requireAdmin, async (req, res) => {
  try {
    const bakers = await User.find({ role: "baker" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(bakers);
  } catch (error) {
    console.error("Error fetching bakers:", error);
    res.status(500).json({ message: "Server error fetching bakers" });
  }
});

// Create baker account (Admin only)
router.post("/bakers", requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Generate temporary password
    const temporaryPassword = generateRandomPassword();

    // Create baker user
    const baker = new User({
      email: email.toLowerCase(),
      password: temporaryPassword,
      role: "baker",
      isFirstLogin: true,
    });

    await baker.save();

    // Send account creation email
    const emailSent = await sendAccountCreationEmail(
      baker.email,
      baker.bakerId,
      temporaryPassword
    );

    if (!emailSent) {
      // If email fails, we should still return success but note the email issue
      console.warn("Baker account created but email failed to send");
    }

    res.status(201).json({
      message: "Baker account created successfully",
      baker: {
        id: baker._id,
        email: baker.email,
        bakerId: baker.bakerId,
        createdAt: baker.createdAt,
      },
      emailSent,
    });
  } catch (error) {
    console.error("Error creating baker:", error);
    res.status(500).json({ message: "Server error creating baker account" });
  }
});

// Update baker email (Admin only)
router.put("/bakers/:id/email", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email is already in use
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: id },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Email is already in use" });
    }

    const baker = await User.findByIdAndUpdate(
      id,
      { email: email.toLowerCase(), updatedAt: new Date() },
      { new: true }
    ).select("-password");

    if (!baker) {
      return res.status(404).json({ message: "Baker not found" });
    }

    res.json({ message: "Baker email updated successfully", baker });
  } catch (error) {
    console.error("Error updating baker email:", error);
    res.status(500).json({ message: "Server error updating baker email" });
  }
});

// Toggle baker active status (Admin only)
router.put("/bakers/:id/toggle-status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const baker = await User.findById(id);
    if (!baker) {
      return res.status(404).json({ message: "Baker not found" });
    }

    baker.isActive = !baker.isActive;
    baker.updatedAt = new Date();
    await baker.save();

    res.json({
      message: `Baker ${
        baker.isActive ? "activated" : "deactivated"
      } successfully`,
      baker: {
        id: baker._id,
        email: baker.email,
        bakerId: baker.bakerId,
        isActive: baker.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling baker status:", error);
    res.status(500).json({ message: "Server error toggling baker status" });
  }
});

// Get current user profile
router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error fetching profile" });
  }
});

module.exports = router;
