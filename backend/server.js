// server.js - Fixed Express server with proper Socket.IO integration
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIo = require("socket.io");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const orderRoutes = require("./routes/orders");
const uploadRoutes = require("./routes/upload");
const {
  authenticateToken,
  requirePasswordChange,
} = require("./middleware/auth");
const { authenticateSocket } = require("./middleware/socketAuth");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with proper CORS
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.FRONTEND_URL || "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true, // Allow Engine.IO v3 clients
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.FRONTEND_URL || "http://localhost:3000",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Make io available to routes
app.set("io", io);

// Database connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/cookie-cutter-orders",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// Socket.IO authentication and connection handling
io.use(authenticateSocket);

// Track connected users
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 User connected:", {
    socketId: socket.id,
    userId: socket.user.id,
    email: socket.user.email,
    role: socket.user.role,
    bakerId: socket.user.bakerId,
  });

  // Store user info
  connectedUsers.set(socket.id, {
    userId: socket.user.id,
    email: socket.user.email,
    role: socket.user.role,
    bakerId: socket.user.bakerId,
    connectedAt: new Date(),
  });

  // Join user to their role-based room
  const userRoom = `${socket.user.role}s`; // 'bakers' or 'admins'
  socket.join(userRoom);
  console.log(`👥 User joined role room: ${userRoom}`);

  // Join baker to their specific room
  if (socket.user.role === "baker") {
    socket.join(`baker-${socket.user.bakerId}`);
    console.log(`👤 Baker joined specific room: baker-${socket.user.bakerId}`);
  }

  // Join admin to all rooms for monitoring
  if (socket.user.role === "admin") {
    socket.join("admins");
    socket.join("bakers"); // Admins can see baker activities
    socket.join("all-orders"); // Admins see all order activities
    console.log("👑 Admin joined monitoring rooms: admins, bakers, all-orders");
  }

  // Join general rooms for order list updates
  socket.join("orders-list");
  socket.join("dashboard-updates");

  console.log("👥 User joined all rooms:", Array.from(socket.rooms));

  // Send connection confirmation
  socket.emit("connection-status", {
    connected: true,
    userId: socket.user.id,
    rooms: Array.from(socket.rooms),
    connectedUsers: connectedUsers.size,
  });

  // Broadcast user count update
  const userCounts = getUserCounts();
  io.emit("user-count-update", userCounts);

  // Handle user disconnection
  socket.on("disconnect", (reason) => {
    console.log("🔌 User disconnected:", {
      email: socket.user.email,
      reason,
      socketId: socket.id,
    });

    // Remove from connected users
    connectedUsers.delete(socket.id);

    // Broadcast updated user count
    const updatedCounts = getUserCounts();
    io.emit("user-count-update", updatedCounts);
  });

  // Handle manual order refresh requests
  socket.on("refresh-order", (orderId) => {
    console.log("🔄 Manual refresh requested for order:", orderId);
    socket.to(`order-${orderId}`).emit("order-refresh-requested", { orderId });
  });

  // Join specific order room for real-time updates
  socket.on("join-order", (orderId) => {
    if (orderId) {
      socket.join(`order-${orderId}`);
      console.log(
        `📋 User ${socket.user.email} joined order room: order-${orderId}`
      );

      // Confirm room join
      socket.emit("room-joined", {
        room: `order-${orderId}`,
        orderId,
      });
    }
  });

  // Leave order room
  socket.on("leave-order", (orderId) => {
    if (orderId) {
      socket.leave(`order-${orderId}`);
      console.log(
        `📋 User ${socket.user.email} left order room: order-${orderId}`
      );

      // Confirm room leave
      socket.emit("room-left", {
        room: `order-${orderId}`,
        orderId,
      });
    }
  });

  // Handle connection status requests
  socket.on("get-connection-status", () => {
    socket.emit("connection-status", {
      connected: true,
      userId: socket.user.id,
      rooms: Array.from(socket.rooms),
      connectedUsers: connectedUsers.size,
      serverTime: new Date().toISOString(),
    });
  });

  // Handle ping requests
  socket.on("ping", (callback) => {
    if (typeof callback === "function") {
      callback("pong");
    }
  });
});

// Helper function to get user counts
function getUserCounts() {
  const users = Array.from(connectedUsers.values());
  return {
    total: users.length,
    admins: users.filter((user) => user.role === "admin").length,
    bakers: users.filter((user) => user.role === "baker").length,
    breakdown: users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {}),
  };
}

// Routes
app.use("/api/users", authenticateToken, requirePasswordChange, userRoutes);
app.use("/api/orders", authenticateToken, requirePasswordChange, orderRoutes);
app.use("/api/upload", authenticateToken, requirePasswordChange, uploadRoutes);

app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "Server is running",
    timestamp: new Date().toISOString(),
    socketConnections: connectedUsers.size,
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
  });
});

// Socket status endpoint
app.get("/api/socket-status", authenticateToken, (req, res) => {
  const rooms = Array.from(io.sockets.adapter.rooms.keys());
  const userCounts = getUserCounts();

  res.json({
    connectedUsers: connectedUsers.size,
    userBreakdown: userCounts,
    rooms: rooms.filter((room) => !room.startsWith("/")), // Filter out socket IDs
    timestamp: new Date().toISOString(),
    connectedUsersList:
      req.user.role === "admin" ? Array.from(connectedUsers.values()) : null,
  });
});

// Test Socket.IO endpoint
app.get("/api/test-socket", authenticateToken, (req, res) => {
  // Send a test notification to the user
  const testMessage = {
    message: `Test notification for ${req.user.email}`,
    type: "info",
    timestamp: new Date().toISOString(),
  };

  if (req.user.role === "admin") {
    io.to("admins").emit("system-notification", testMessage);
  } else {
    io.to(`baker-${req.user.bakerId}`).emit("system-notification", testMessage);
  }

  res.json({
    message: "Test notification sent",
    targetRoom:
      req.user.role === "admin" ? "admins" : `baker-${req.user.bakerId}`,
    connectedUsers: connectedUsers.size,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Endpoint not found",
    path: req.path,
    method: req.method,
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("🛑 Received shutdown signal, shutting down gracefully");

  server.close(() => {
    console.log("🔌 HTTP server closed");

    mongoose.connection.close(false, () => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error(
      "🚨 Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("🚨 Uncaught Exception:", err);
  gracefulShutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown();
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔌 Socket.IO enabled for real-time updates`);
  console.log(
    `📡 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = { app, io, server };
