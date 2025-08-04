// src/contexts/SocketContext.js - Fixed Socket.IO context for real-time updates
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
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({
    total: 0,
    admins: 0,
    bakers: 0,
  });
  const { user, token } = useAuth();
  const { showSuccess, showInfo, showWarning, showError } = useToast();

  // Initialize socket connection
  useEffect(() => {
    if (user && token) {
      console.log("🔌 Initializing socket connection for:", user.email);

      // Determine the server URL
      const serverUrl = process.env.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL.replace("/api", "")
        : "http://localhost:5000";

      console.log("🌐 Connecting to socket server:", serverUrl);

      const socketInstance = io(serverUrl, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true, // Force a new connection
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5,
        autoConnect: true,
      });

      // Connection events
      socketInstance.on("connect", () => {
        console.log("✅ Socket connected:", socketInstance.id);
        setIsConnected(true);
        setSocket(socketInstance);
        setConnectionError(null);
      });

      socketInstance.on("disconnect", (reason) => {
        console.log("🔌 Socket disconnected:", reason);
        setIsConnected(false);

        if (reason === "io server disconnect") {
          // The disconnection was initiated by the server, reconnect manually
          socketInstance.connect();
        }
      });

      socketInstance.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
        setIsConnected(false);
        setConnectionError(error.message);

        // Show user-friendly error message
        if (error.message.includes("Invalid namespace")) {
          showError("Connection error: Invalid server configuration");
        } else if (error.message.includes("Authentication")) {
          showError("Connection error: Authentication failed");
        } else {
          showError("Unable to connect to real-time updates");
        }
      });

      socketInstance.on("reconnect", (attemptNumber) => {
        console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
        setIsConnected(true);
        setConnectionError(null);
        showSuccess("Real-time connection restored");
      });

      socketInstance.on("reconnect_error", (error) => {
        console.error("❌ Socket reconnection error:", error);
        setConnectionError(error.message);
      });

      socketInstance.on("reconnect_failed", () => {
        console.error("❌ Socket reconnection failed");
        showError("Failed to restore real-time connection");
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
          case "error":
            showError(message);
            break;
          case "info":
          default:
            showInfo(message);
            break;
        }
      });

      // Connection status updates
      socketInstance.on("connection-status", (data) => {
        console.log("📊 Connection status:", data);
        setOnlineUsers({
          total: data.connectedUsers || 0,
          admins: data.adminCount || 0,
          bakers: data.bakerCount || 0,
        });
      });

      return () => {
        console.log("🔌 Cleaning up socket connection");
        if (socketInstance) {
          socketInstance.removeAllListeners();
          socketInstance.disconnect();
        }
        setSocket(null);
        setIsConnected(false);
        setConnectionError(null);
      };
    } else {
      // Clean up if user logs out
      if (socket) {
        console.log("🔌 User logged out, disconnecting socket");
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setConnectionError(null);
      }
    }
  }, [user, token, showSuccess, showInfo, showWarning, showError]);

  // Join order room for real-time updates
  const joinOrderRoom = (orderId) => {
    if (socket && orderId && isConnected) {
      console.log("📋 Joining order room:", orderId);
      socket.emit("join-order", orderId);
    } else {
      console.warn("Cannot join order room - socket not connected", {
        hasSocket: !!socket,
        orderId,
        isConnected,
      });
    }
  };

  // Leave order room
  const leaveOrderRoom = (orderId) => {
    if (socket && orderId && isConnected) {
      console.log("📋 Leaving order room:", orderId);
      socket.emit("leave-order", orderId);
    }
  };

  // Subscribe to order updates
  const subscribeToOrderUpdates = (callback) => {
    if (socket && isConnected) {
      console.log("📡 Subscribing to order updates");
      socket.on("order-updated", callback);

      return () => {
        console.log("📡 Unsubscribing from order updates");
        if (socket) {
          socket.off("order-updated", callback);
        }
      };
    } else {
      console.warn("Cannot subscribe to order updates - socket not connected");
      return () => {}; // Return empty cleanup function
    }
  };

  // Subscribe to image updates
  const subscribeToImageUpdates = (callback) => {
    if (socket && isConnected) {
      console.log("📡 Subscribing to image updates");
      socket.on("image-updated", callback);

      return () => {
        console.log("📡 Unsubscribing from image updates");
        if (socket) {
          socket.off("image-updated", callback);
        }
      };
    } else {
      console.warn("Cannot subscribe to image updates - socket not connected");
      return () => {}; // Return empty cleanup function
    }
  };

  // Subscribe to user updates (admin only)
  const subscribeToUserUpdates = (callback) => {
    if (socket && isConnected && user?.role === "admin") {
      console.log("📡 Subscribing to user updates");
      socket.on("user-updated", callback);

      return () => {
        console.log("📡 Unsubscribing from user updates");
        if (socket) {
          socket.off("user-updated", callback);
        }
      };
    } else {
      return () => {}; // Return empty cleanup function
    }
  };

  // Manual refresh request
  const requestOrderRefresh = (orderId) => {
    if (socket && orderId && isConnected) {
      console.log("🔄 Requesting order refresh:", orderId);
      socket.emit("refresh-order", orderId);
    } else {
      console.warn("Cannot request refresh - socket not connected");
    }
  };

  // Get connection status
  const getConnectionInfo = () => {
    return {
      isConnected,
      hasSocket: !!socket,
      socketId: socket?.id,
      error: connectionError,
      user: user?.email,
    };
  };

  // Manual reconnect
  const reconnect = () => {
    if (socket && !isConnected) {
      console.log("🔄 Manual reconnect attempt");
      socket.connect();
    }
  };

  const value = {
    socket,
    isConnected,
    connectionError,
    onlineUsers,
    joinOrderRoom,
    leaveOrderRoom,
    subscribeToOrderUpdates,
    subscribeToImageUpdates,
    subscribeToUserUpdates,
    requestOrderRefresh,
    getConnectionInfo,
    reconnect,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
