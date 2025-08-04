// backend/middleware/socketAuth.js - Socket.IO authentication middleware
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Authenticate socket connections
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("❌ Socket connection rejected: No token provided");
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    // Get user from database
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      console.log("❌ Socket connection rejected: Invalid user or inactive");
      return next(new Error("Authentication error: Invalid user"));
    }

    // Attach user to socket
    socket.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      bakerId: user.bakerId,
    };

    console.log("✅ Socket authenticated:", {
      userId: socket.user.id,
      email: socket.user.email,
      role: socket.user.role,
    });

    next();
  } catch (error) {
    console.log("❌ Socket authentication failed:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = {
  authenticateSocket,
};
