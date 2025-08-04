// backend/utils/socketUtils.js - Socket.IO helper functions
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
    eventType, // 'created', 'updated', 'stage_changed', 'item_added', etc.
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
    rooms: [`order-${orderId}`, "admins", `baker-${orderData.bakerId}`],
  });

  // Emit to specific order room
  io.to(`order-${orderId}`).emit("order-updated", updateData);

  // Emit to all admins
  io.to("admins").emit("order-updated", updateData);

  // Emit to the specific baker
  if (orderData.bakerId) {
    io.to(`baker-${orderData.bakerId}`).emit("order-updated", updateData);
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
  });

  // Emit to specific order room
  io.to(`order-${orderId}`).emit("image-updated", updateData);

  // Emit to all admins
  io.to("admins").emit("image-updated", updateData);
};

const emitUserUpdate = (io, userData, eventType, updatedByEmail) => {
  const updateData = {
    user: userData,
    eventType, // 'user_created', 'user_updated', 'user_activated', 'user_deactivated'
    updatedBy: updatedByEmail,
    timestamp: new Date().toISOString(),
  };

  console.log("📡 Emitting user update:", {
    eventType,
    userId: userData._id,
    updatedBy: updatedByEmail,
  });

  // Emit to all admins
  io.to("admins").emit("user-updated", updateData);

  // If it's a baker update, emit to that specific baker
  if (userData.role === "baker" && userData.bakerId) {
    io.to(`baker-${userData.bakerId}`).emit("user-updated", updateData);
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

module.exports = {
  emitOrderUpdate,
  emitImageUpdate,
  emitUserUpdate,
  emitSystemNotification,
  getConnectedUsers,
};
