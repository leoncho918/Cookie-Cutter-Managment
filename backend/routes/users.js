// routes/users.js - Enhanced User management routes with name and phone fields
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

// Create baker account (Admin only) - Enhanced with name and phone
router.post("/bakers", requireAdmin, async (req, res) => {
  try {
    const { email, firstName, lastName, phoneNumber } = req.body;

    // Validation
    if (!email || !firstName || !lastName || !phoneNumber) {
      return res.status(400).json({
        message: "Email, first name, last name, and phone number are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }

    // Validate phone number
    const phoneValidation = User.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    // Validate name fields
    if (firstName.trim().length < 2 || firstName.trim().length > 50) {
      return res.status(400).json({
        message: "First name must be between 2 and 50 characters",
      });
    }

    if (lastName.trim().length < 2 || lastName.trim().length > 50) {
      return res.status(400).json({
        message: "Last name must be between 2 and 50 characters",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phoneNumber: phoneNumber.trim() },
      ],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      } else {
        return res
          .status(400)
          .json({ message: "User with this phone number already exists" });
      }
    }

    // Generate temporary password
    const temporaryPassword = generateRandomPassword();

    // Create baker user
    const baker = new User({
      email: email.toLowerCase(),
      password: temporaryPassword,
      role: "baker",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
      isFirstLogin: true,
    });

    await baker.save();

    console.log("👤 Baker account created:", {
      bakerId: baker.bakerId,
      email: baker.email,
      fullName: baker.fullName,
      phoneNumber: baker.phoneNumber,
      createdBy: req.user.email,
    });

    // Send account creation email with enhanced information
    const emailSent = await sendAccountCreationEmail(
      baker.email,
      baker.bakerId,
      temporaryPassword,
      {
        firstName: baker.firstName,
        lastName: baker.lastName,
        phoneNumber: baker.phoneNumber,
      }
    );

    if (!emailSent) {
      console.warn("Baker account created but email failed to send");
    }

    res.status(201).json({
      message: "Baker account created successfully",
      baker: {
        id: baker._id,
        email: baker.email,
        firstName: baker.firstName,
        lastName: baker.lastName,
        fullName: baker.fullName,
        phoneNumber: baker.phoneNumber,
        bakerId: baker.bakerId,
        createdAt: baker.createdAt,
      },
      emailSent,
    });
  } catch (error) {
    console.error("Error creating baker:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === "email") {
        return res
          .status(400)
          .json({ message: "Email address already exists" });
      } else if (field === "phoneNumber") {
        return res.status(400).json({ message: "Phone number already exists" });
      }
    }

    res.status(500).json({ message: "Server error creating baker account" });
  }
});

// Update baker information (Admin only) - Enhanced with all fields
router.put("/bakers/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, phoneNumber } = req.body;

    // Validation
    if (!email || !firstName || !lastName || !phoneNumber) {
      return res.status(400).json({
        message: "Email, first name, last name, and phone number are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }

    // Validate phone number
    const phoneValidation = User.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    // Validate name fields
    if (firstName.trim().length < 2 || firstName.trim().length > 50) {
      return res.status(400).json({
        message: "First name must be between 2 and 50 characters",
      });
    }

    if (lastName.trim().length < 2 || lastName.trim().length > 50) {
      return res.status(400).json({
        message: "Last name must be between 2 and 50 characters",
      });
    }

    // Check if email or phone is already in use by another user
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: id } },
        {
          $or: [
            { email: email.toLowerCase() },
            { phoneNumber: phoneNumber.trim() },
          ],
        },
      ],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res
          .status(400)
          .json({ message: "Email is already in use by another user" });
      } else {
        return res
          .status(400)
          .json({ message: "Phone number is already in use by another user" });
      }
    }

    const baker = await User.findByIdAndUpdate(
      id,
      {
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        updatedAt: new Date(),
      },
      { new: true }
    ).select("-password");

    if (!baker) {
      return res.status(404).json({ message: "Baker not found" });
    }

    console.log("👤 Baker information updated:", {
      bakerId: baker.bakerId,
      email: baker.email,
      fullName: baker.fullName,
      phoneNumber: baker.phoneNumber,
      updatedBy: req.user.email,
    });

    res.json({
      message: "Baker information updated successfully",
      baker: {
        id: baker._id,
        email: baker.email,
        firstName: baker.firstName,
        lastName: baker.lastName,
        fullName: baker.fullName,
        phoneNumber: baker.phoneNumber,
        bakerId: baker.bakerId,
        isActive: baker.isActive,
        updatedAt: baker.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating baker information:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === "email") {
        return res
          .status(400)
          .json({ message: "Email address already exists" });
      } else if (field === "phoneNumber") {
        return res.status(400).json({ message: "Phone number already exists" });
      }
    }

    res
      .status(500)
      .json({ message: "Server error updating baker information" });
  }
});

// Legacy email update endpoint (kept for backward compatibility)
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

    console.log(`👤 Baker ${baker.isActive ? "activated" : "deactivated"}:`, {
      bakerId: baker.bakerId,
      fullName: baker.fullName,
      email: baker.email,
      isActive: baker.isActive,
      changedBy: req.user.email,
    });

    res.json({
      message: `Baker ${
        baker.isActive ? "activated" : "deactivated"
      } successfully`,
      baker: {
        id: baker._id,
        email: baker.email,
        firstName: baker.firstName,
        lastName: baker.lastName,
        fullName: baker.fullName,
        phoneNumber: baker.phoneNumber,
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

// Update current user profile (for bakers to update their own info)
router.put("/profile", async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    const userId = req.user._id;

    // Validation
    if (!firstName || !lastName || !phoneNumber) {
      return res.status(400).json({
        message: "First name, last name, and phone number are required",
      });
    }

    // Validate phone number
    const phoneValidation = User.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.message });
    }

    // Validate name fields
    if (firstName.trim().length < 2 || firstName.trim().length > 50) {
      return res.status(400).json({
        message: "First name must be between 2 and 50 characters",
      });
    }

    if (lastName.trim().length < 2 || lastName.trim().length > 50) {
      return res.status(400).json({
        message: "Last name must be between 2 and 50 characters",
      });
    }

    // Check if phone number is already in use by another user
    const existingUser = await User.findOne({
      _id: { $ne: userId },
      phoneNumber: phoneNumber.trim(),
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Phone number is already in use" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        updatedAt: new Date(),
      },
      { new: true }
    ).select("-password");

    console.log("👤 User profile updated:", {
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
    });

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);

    if (error.code === 11000) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    res.status(500).json({ message: "Server error updating profile" });
  }
});

// Search bakers (Admin only) - Enhanced search with name and phone
router.get("/bakers/search", requireAdmin, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Search query must be at least 2 characters" });
    }

    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, "i");

    const bakers = await User.find({
      role: "baker",
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { bakerId: searchRegex },
      ],
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      query: searchQuery,
      results: bakers,
      count: bakers.length,
    });
  } catch (error) {
    console.error("Error searching bakers:", error);
    res.status(500).json({ message: "Server error searching bakers" });
  }
});

// Get baker statistics (Admin only)
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: "baker" } },
      {
        $group: {
          _id: null,
          totalBakers: { $sum: 1 },
          activeBakers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          inactiveBakers: {
            $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
          },
          firstLoginPending: {
            $sum: { $cond: [{ $eq: ["$isFirstLogin", true] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalBakers: 0,
      activeBakers: 0,
      inactiveBakers: 0,
      firstLoginPending: 0,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching baker statistics:", error);
    res.status(500).json({ message: "Server error fetching statistics" });
  }
});

module.exports = router;
