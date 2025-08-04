// backend/utils/socketUtils.js - Enhanced Socket.IO helper functions
const emitOrderUpdate = (
  io,
  orderId,
  orderData,
  eventType,
  userId,
  userEmail
) => {
  const updateData = {
    orderId,
    order: orderData,
    eventType, // 'created', 'updated', 'stage_changed', 'item_added', 'item_updated', 'item_deleted', 'deleted', 'completion_updated'
    updatedBy: {
      userId,
      email: userEmail,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting order update:", {
    orderId,
    eventType,
    updatedBy: userEmail,
    orderNumber: orderData.orderNumber || orderData._id,
    bakerId: orderData.bakerId,
    targetRooms: [
      `order-${orderId}`,
      "admins",
      "all-orders",
      `baker-${orderData.bakerId}`,
      "orders-list",
      "dashboard-updates",
    ],
  });

  // Emit to specific order room (users currently viewing this order)
  io.to(`order-${orderId}`).emit("order-updated", updateData);

  // Emit to all admins (they can see all order activities)
  io.to("admins").emit("order-updated", updateData);
  io.to("all-orders").emit("order-updated", updateData);

  // Emit to the specific baker (if it's their order)
  if (orderData.bakerId) {
    io.to(`baker-${orderData.bakerId}`).emit("order-updated", updateData);
  }

  // Emit to orders list room for list refreshes
  io.to("orders-list").emit("order-list-update", updateData);

  // Emit to dashboard updates room
  io.to("dashboard-updates").emit("dashboard-update", updateData);

  // Special handling for different event types
  switch (eventType) {
    case "deleted":
      console.log("🗑️ Broadcasting order deletion to all relevant rooms");
      // For deletions, also emit to the general orders list room
      io.to("orders-list").emit("order-deleted", {
        orderId,
        orderNumber: orderData.orderNumber,
        deletedBy: {
          userId,
          email: userEmail,
        },
        timestamp: new Date().toISOString(),
      });
      break;

    case "created":
      console.log("🆕 Broadcasting new order creation to all relevant rooms");
      // For new orders, emit to orders list room and admins
      io.to("orders-list").emit("order-created", updateData);
      io.to("admins").emit("new-order-notification", {
        orderId,
        orderNumber: orderData.orderNumber,
        bakerId: orderData.bakerId,
        bakerEmail: orderData.bakerEmail,
        createdBy: {
          userId,
          email: userEmail,
        },
        timestamp: new Date().toISOString(),
      });
      break;

    case "stage_changed":
      console.log("🔄 Broadcasting stage change to relevant parties");
      // For stage changes, emit specific stage change event
      if (orderData.bakerId) {
        io.to(`baker-${orderData.bakerId}`).emit("order-stage-changed", {
          orderId,
          orderNumber: orderData.orderNumber,
          newStage: orderData.stage,
          changedBy: {
            userId,
            email: userEmail,
          },
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case "item_added":
    case "item_updated":
    case "item_deleted":
      console.log("📝 Broadcasting item changes to relevant parties");
      // For item changes, emit item-specific events
      io.to(`order-${orderId}`).emit("order-items-changed", {
        orderId,
        orderNumber: orderData.orderNumber,
        eventType,
        itemCount: orderData.items?.length || 0,
        updatedBy: {
          userId,
          email: userEmail,
        },
        timestamp: new Date().toISOString(),
      });
      break;
  }
};

const emitImageUpdate = (
  io,
  orderId,
  itemId,
  imageData,
  eventType,
  imageType,
  userId,
  userEmail
) => {
  const updateData = {
    orderId,
    itemId,
    image: imageData,
    imageType, // 'inspiration' or 'preview'
    eventType, // 'image_uploaded', 'image_deleted'
    updatedBy: {
      userId,
      email: userEmail,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting image update:", {
    orderId,
    itemId,
    eventType,
    imageType,
    updatedBy: userEmail,
    imageUrl: imageData.url,
  });

  // Emit to specific order room
  io.to(`order-${orderId}`).emit("image-updated", updateData);

  // Emit to all admins
  io.to("admins").emit("image-updated", updateData);

  // Additional specific event for image gallery updates
  io.to(`order-${orderId}`).emit("order-images-changed", {
    orderId,
    itemId,
    imageType,
    eventType,
    timestamp: new Date().toISOString(),
  });
};

const emitUserUpdate = (io, userData, eventType, updatedByEmail) => {
  const updateData = {
    user: userData,
    eventType, // 'user_created', 'user_updated', 'user_activated', 'user_deactivated', 'password_reset'
    updatedBy: updatedByEmail,
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting user update:", {
    eventType,
    userId: userData._id,
    userEmail: userData.email,
    updatedBy: updatedByEmail,
  });

  // Emit to all admins
  io.to("admins").emit("user-updated", updateData);

  // If it's a baker update, emit to that specific baker
  if (userData.role === "baker" && userData.bakerId) {
    io.to(`baker-${userData.bakerId}`).emit("user-updated", updateData);
  }

  // Special handling for account status changes
  if (eventType === "user_deactivated") {
    // Notify the affected user if they're connected
    io.to(`baker-${userData.bakerId}`).emit("account-status-changed", {
      status: "deactivated",
      message: "Your account has been deactivated by an administrator.",
      timestamp: new Date().toISOString(),
    });
  } else if (eventType === "user_activated") {
    io.to(`baker-${userData.bakerId}`).emit("account-status-changed", {
      status: "activated",
      message: "Your account has been reactivated by an administrator.",
      timestamp: new Date().toISOString(),
    });
  } else if (eventType === "password_reset") {
    io.to(`baker-${userData.bakerId}`).emit("password-reset-notification", {
      message:
        "Your password has been reset. Please check your email for the new temporary password.",
      timestamp: new Date().toISOString(),
    });
  }
};

const emitSystemNotification = (
  io,
  message,
  type = "info",
  targetRooms = ["admins", "bakers"]
) => {
  const notificationData = {
    message,
    type, // 'info', 'warning', 'error', 'success'
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting system notification:", {
    message,
    type,
    targetRooms,
  });

  targetRooms.forEach((room) => {
    io.to(room).emit("system-notification", notificationData);
  });
};

// Get connected users count by role
const getConnectedUsers = (io) => {
  const rooms = io.sockets.adapter.rooms;

  return {
    total: io.engine.clientsCount,
    admins: rooms.get("admins")?.size || 0,
    bakers: rooms.get("bakers")?.size || 0,
    breakdown: {
      admins: Array.from(rooms.get("admins") || []).length,
      bakers: Array.from(rooms.get("bakers") || []).length,
    },
  };
};

// Emit order list refresh (for when users need to refresh their order lists)
const emitOrderListRefresh = (io, targetRooms = ["admins", "bakers"]) => {
  const refreshData = {
    action: "refresh_order_list",
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting order list refresh to:", targetRooms);

  targetRooms.forEach((room) => {
    io.to(room).emit("order-list-refresh", refreshData);
  });
};

// Emit dashboard refresh (for when dashboard statistics need updating)
const emitDashboardRefresh = (io, targetRooms = ["admins", "bakers"]) => {
  const refreshData = {
    action: "refresh_dashboard",
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting dashboard refresh to:", targetRooms);

  targetRooms.forEach((room) => {
    io.to(room).emit("dashboard-refresh", refreshData);
  });
};

// Emit connection status update
const emitConnectionStatus = (io, userId, status) => {
  const statusData = {
    userId,
    status, // 'connected', 'disconnected'
    timestamp: new Date().toISOString(),
    connectedUsers: getConnectedUsers(io),
  };

  console.log("📡 Emitting connection status:", statusData);

  // Emit to all connected users
  io.emit("connection-status-update", statusData);
};

// Join user to various rooms based on their role and activities
const joinUserToRooms = (socket, user) => {
  console.log("🏠 Setting up rooms for user:", {
    userId: user.id,
    email: user.email,
    role: user.role,
    bakerId: user.bakerId,
  });

  // Join role-based room
  const roleRoom = `${user.role}s`; // 'admins' or 'bakers'
  socket.join(roleRoom);

  // Join specific user room
  socket.join(`user-${user.id}`);

  // Join baker-specific room if baker
  if (user.role === "baker" && user.bakerId) {
    socket.join(`baker-${user.bakerId}`);
  }

  // Join orders list room for order list updates
  socket.join("orders-list");

  // Join dashboard room for dashboard updates
  socket.join("dashboard");

  // Admins get additional rooms
  if (user.role === "admin") {
    socket.join("admin-notifications");
    socket.join("user-management");
  }

  console.log("✅ User joined rooms:", Array.from(socket.rooms));
};

// Leave user from all custom rooms (cleanup on disconnect)
const leaveUserFromRooms = (socket, user) => {
  console.log("🚪 Cleaning up rooms for user:", {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Leave all custom rooms (socket.io automatically handles the default room)
  const roomsToLeave = [
    `${user.role}s`,
    `user-${user.id}`,
    `baker-${user.bakerId}`,
    "orders-list",
    "dashboard",
    "admin-notifications",
    "user-management",
  ];

  roomsToLeave.forEach((room) => {
    if (room && room !== "undefined") {
      socket.leave(room);
    }
  });
};

// Emit bulk order updates (useful for admin operations that affect multiple orders)
const emitBulkOrderUpdate = (io, orderIds, eventType, userId, userEmail) => {
  const bulkUpdateData = {
    orderIds,
    eventType, // 'bulk_stage_change', 'bulk_delete', etc.
    updatedBy: {
      userId,
      email: userEmail,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting bulk order update:", {
    orderCount: orderIds.length,
    eventType,
    updatedBy: userEmail,
  });

  // Emit to all relevant rooms
  io.to("admins").emit("bulk-order-update", bulkUpdateData);
  io.to("orders-list").emit("order-list-refresh", {
    reason: "bulk_update",
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  emitOrderUpdate,
  emitImageUpdate,
  emitUserUpdate,
  emitSystemNotification,
  getConnectedUsers,
  emitOrderListRefresh,
  emitDashboardRefresh,
  emitConnectionStatus,
  joinUserToRooms,
  leaveUserFromRooms,
  emitBulkOrderUpdate,
};
