// routes/auth.js - Authentication routes
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  generateRandomPassword,
  sendPasswordResetEmail,
} = require("../utils/email");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        bakerId: user.bakerId,
        isFirstLogin: user.isFirstLogin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Change password (for first login and regular password changes)
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new passwords are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password and first login flag
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Server error during password change" });
  }
});

// Reset password (Admin only)
router.post("/reset-password", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate temporary password
    const temporaryPassword = generateRandomPassword();

    // Update user password
    user.password = temporaryPassword;
    user.isFirstLogin = true;
    await user.save();

    // Send email with temporary password
    const emailSent = await sendPasswordResetEmail(
      user.email,
      temporaryPassword
    );

    if (!emailSent) {
      return res
        .status(500)
        .json({ message: "Password reset but email failed to send" });
    }

    res.json({
      message:
        "Password reset successfully. Temporary password sent via email.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
});

module.exports = router;
