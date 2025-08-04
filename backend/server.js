// server.js - Complete Express server with Socket.IO integration
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
const { authenticateToken } = require("./middleware/auth");
const { authenticateSocket } = require("./middleware/socketAuth");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
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

io.on("connection", (socket) => {
  console.log("🔌 User connected:", {
    socketId: socket.id,
    userId: socket.user.id,
    email: socket.user.email,
    role: socket.user.role,
  });

  // Join user to their role-based room
  const userRoom = `${socket.user.role}s`; // 'bakers' or 'admins'
  socket.join(userRoom);

  // Join baker to their specific room
  if (socket.user.role === "baker") {
    socket.join(`baker-${socket.user.bakerId}`);
  }

  // Join admin to all rooms for monitoring
  if (socket.user.role === "admin") {
    socket.join("admins");
    socket.join("bakers"); // Admins can see baker activities
  }

  console.log("👥 User joined rooms:", Array.from(socket.rooms));

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("🔌 User disconnected:", socket.user.email);
  });

  // Handle manual order refresh requests
  socket.on("refresh-order", (orderId) => {
    console.log("🔄 Manual refresh requested for order:", orderId);
    socket.to(`order-${orderId}`).emit("order-refresh-requested", { orderId });
  });

  // Join specific order room for real-time updates
  socket.on("join-order", (orderId) => {
    socket.join(`order-${orderId}`);
    console.log(
      `📋 User ${socket.user.email} joined order room: order-${orderId}`
    );
  });

  // Leave order room
  socket.on("leave-order", (orderId) => {
    socket.leave(`order-${orderId}`);
    console.log(
      `📋 User ${socket.user.email} left order room: order-${orderId}`
    );
  });

  // Handle connection status requests
  socket.on("get-connection-status", () => {
    socket.emit("connection-status", {
      connected: true,
      userId: socket.user.id,
      rooms: Array.from(socket.rooms),
    });
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/orders", authenticateToken, orderRoutes);
app.use("/api/upload", authenticateToken, uploadRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "Server is running",
    timestamp: new Date().toISOString(),
    socketConnections: io.engine.clientsCount,
    environment: process.env.NODE_ENV || "development",
  });
});

// Socket status endpoint
app.get("/api/socket-status", authenticateToken, (req, res) => {
  const rooms = Array.from(io.sockets.adapter.rooms.keys());
  const connectedUsers = io.engine.clientsCount;

  res.json({
    connectedUsers,
    rooms: rooms.filter((room) => !room.startsWith("/")), // Filter out socket IDs
    timestamp: new Date().toISOString(),
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

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("🔌 HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔌 Socket.IO enabled for real-time updates`);
  console.log(
    `📡 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );
});

module.exports = { app, io, server };
