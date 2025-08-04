// src/contexts/SocketContext.js - Socket.IO context for real-time updates
import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({
    total: 0,
    admins: 0,
    bakers: 0,
  });
  const { user, token } = useAuth();
  const { showSuccess, showInfo, showWarning } = useToast();

  // Initialize socket connection
  useEffect(() => {
    if (user && token) {
      console.log("🔌 Initializing socket connection for:", user.email);

      const socketInstance = io(
        process.env.REACT_APP_API_URL || "http://localhost:5000",
        {
          auth: {
            token: token,
          },
          transports: ["websocket", "polling"],
        }
      );

      // Connection events
      socketInstance.on("connect", () => {
        console.log("✅ Socket connected:", socketInstance.id);
        setIsConnected(true);
        setSocket(socketInstance);
      });

      socketInstance.on("disconnect", () => {
        console.log("🔌 Socket disconnected");
        setIsConnected(false);
      });

      socketInstance.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
        setIsConnected(false);
      });

      // System notifications
      socketInstance.on("system-notification", (data) => {
        console.log("📢 System notification:", data);

        const { message, type } = data;
        switch (type) {
          case "success":
            showSuccess(message);
            break;
          case "warning":
            showWarning(message);
            break;
          case "info":
          default:
            showInfo(message);
            break;
        }
      });

      return () => {
        console.log("🔌 Cleaning up socket connection");
        socketInstance.disconnect();
      };
    }
  }, [user, token, showSuccess, showInfo, showWarning]);

  // Join order room for real-time updates
  const joinOrderRoom = (orderId) => {
    if (socket && orderId) {
      console.log("📋 Joining order room:", orderId);
      socket.emit("join-order", orderId);
    }
  };

  // Leave order room
  const leaveOrderRoom = (orderId) => {
    if (socket && orderId) {
      console.log("📋 Leaving order room:", orderId);
      socket.emit("leave-order", orderId);
    }
  };

  // Subscribe to order updates
  const subscribeToOrderUpdates = (callback) => {
    if (socket) {
      console.log("📡 Subscribing to order updates");
      socket.on("order-updated", callback);

      return () => {
        console.log("📡 Unsubscribing from order updates");
        socket.off("order-updated", callback);
      };
    }
  };

  // Subscribe to image updates
  const subscribeToImageUpdates = (callback) => {
    if (socket) {
      console.log("📡 Subscribing to image updates");
      socket.on("image-updated", callback);

      return () => {
        console.log("📡 Unsubscribing from image updates");
        socket.off("image-updated", callback);
      };
    }
  };

  // Subscribe to user updates (admin only)
  const subscribeToUserUpdates = (callback) => {
    if (socket && user?.role === "admin") {
      console.log("📡 Subscribing to user updates");
      socket.on("user-updated", callback);

      return () => {
        console.log("📡 Unsubscribing from user updates");
        socket.off("user-updated", callback);
      };
    }
  };

  // Manual refresh request
  const requestOrderRefresh = (orderId) => {
    if (socket && orderId) {
      console.log("🔄 Requesting order refresh:", orderId);
      socket.emit("refresh-order", orderId);
    }
  };

  const value = {
    socket,
    isConnected,
    onlineUsers,
    joinOrderRoom,
    leaveOrderRoom,
    subscribeToOrderUpdates,
    subscribeToImageUpdates,
    subscribeToUserUpdates,
    requestOrderRefresh,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
