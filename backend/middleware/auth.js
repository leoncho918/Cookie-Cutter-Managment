// middleware/auth.js - Authentication middleware
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ message: "Invalid token or user inactive" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Check if user is baker or admin
const requireBakerOrAdmin = (req, res, next) => {
  if (req.user.role !== "baker" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Baker or Admin access required" });
  }
  next();
};

// Check if user needs to change password on first login
const requirePasswordChange = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (user && user.isFirstLogin) {
      return res.status(403).json({
        message: "Password change required",
        requiresPasswordChange: true,
        isFirstLogin: true,
      });
    }

    next();
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error checking user status" });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireBakerOrAdmin,
  requirePasswordChange,
};
