// src/components/Orders/Orders.js - Fixed Orders list with working pickup filters and date range
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import {
  ORDER_STAGES,
  DELIVERY_METHODS,
  PAYMENT_METHODS,
  getStageColor,
  formatDate,
} from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import axios from "axios";

const Orders = () => {
  const { user } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();

  // Enhanced Socket.IO integration
  const { isConnected, socket, subscribeToOrderUpdates } = useSocket();

  const [orders, setOrders] = useState([]);
  const [bakers, setBakers] = useState([]); // For baker dropdown
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    stage: "",
    bakerId: "",
    bakerEmail: "",
    dateFrom: "",
    dateTo: "",
    deliveryMethod: "",
    paymentMethod: "",
    pickupStatus: "",
    pickupDateFrom: "", // NEW: Pickup date from filter
    pickupDateTo: "", // NEW: Pickup date to filter
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    orderId: null,
  });

  useEffect(() => {
    loadOrders();
    // Load bakers list for admin filtering
    if (user.role === "admin") {
      loadBakers();
    }
  }, [filters]);

  // Enhanced real-time updates for orders list
  useEffect(() => {
    if (!isConnected || !socket) return;

    console.log("🔌 Setting up enhanced socket listeners for orders list");

    // Subscribe to general order updates
    const unsubscribeOrder = subscribeToOrderUpdates((updateData) => {
      console.log("📡 Orders list received update:", updateData);

      const { eventType, updatedBy, order: updatedOrder } = updateData;

      // Show notifications for updates from other users
      if (updatedBy.email !== user.email) {
        let message = "";
        switch (eventType) {
          case "created":
            message = `New order ${updatedOrder.orderNumber} created by ${updatedBy.email}`;
            break;
          case "stage_changed":
            message = `Order ${updatedOrder.orderNumber} moved to ${updatedOrder.stage}`;
            break;
          case "deleted":
            message = `Order ${
              updatedOrder.orderNumber || "deleted"
            } was deleted`;
            break;
          case "completion_updated":
            message = `Order ${updatedOrder.orderNumber} completion details updated`;
            break;
          default:
            message = `Order ${updatedOrder.orderNumber} ${eventType.replace(
              "_",
              " "
            )}`;
        }
        showInfo(message);
      }

      // Refresh the orders list
      loadOrders();
    });

    // Listen for specific order list events
    const handleOrderListUpdate = (data) => {
      console.log("📋 Order list update received:", data);
      loadOrders();
    };

    const handleNewOrderNotification = (data) => {
      if (user.role === "admin" && data.createdBy.email !== user.email) {
        console.log("🆕 New order notification for admin:", data);
        showSuccess(
          `New order ${data.orderNumber} created by ${data.bakerEmail}`
        );
        loadOrders();
      }
    };

    const handleOrderDeleted = (data) => {
      console.log("🗑️ Order deleted notification:", data);
      if (data.deletedBy.email !== user.email) {
        showInfo(
          `Order ${data.orderNumber} was deleted by ${data.deletedBy.email}`
        );
      }
      loadOrders();
    };

    const handleOrderCreated = (data) => {
      console.log("🆕 Order created notification:", data);
      if (data.updatedBy.email !== user.email) {
        const { order } = data;
        showInfo(
          `New order ${order.orderNumber} created by ${data.updatedBy.email}`
        );
      }
      loadOrders();
    };

    const handleDashboardUpdate = (data) => {
      console.log("📊 Dashboard update received:", data);
      // This can be used to update statistics in real-time
    };

    // Set up Socket.IO event listeners
    if (socket) {
      socket.on("order-list-update", handleOrderListUpdate);
      socket.on("new-order-notification", handleNewOrderNotification);
      socket.on("order-deleted", handleOrderDeleted);
      socket.on("order-created", handleOrderCreated);
      socket.on("dashboard-update", handleDashboardUpdate);
    }

    return () => {
      console.log("🔌 Cleaning up orders list socket listeners");

      if (unsubscribeOrder) unsubscribeOrder();

      if (socket) {
        socket.off("order-list-update", handleOrderListUpdate);
        socket.off("new-order-notification", handleNewOrderNotification);
        socket.off("order-deleted", handleOrderDeleted);
        socket.off("order-created", handleOrderCreated);
        socket.off("dashboard-update", handleDashboardUpdate);
      }
    };
  }, [
    isConnected,
    socket,
    subscribeToOrderUpdates,
    user.email,
    user.role,
    showInfo,
    showSuccess,
  ]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      // Add all filters except pickup-specific filters to server request
      Object.entries(filters).forEach(([key, value]) => {
        if (value && !key.startsWith("pickup")) {
          params.append(key, value);
        }
      });

      console.log("🔄 Loading orders with filters:", filters);
      const response = await axios.get(`/orders?${params.toString()}`);

      let ordersData = response.data;

      // Apply client-side pickup filters if needed
      if (
        filters.pickupStatus ||
        filters.pickupDateFrom ||
        filters.pickupDateTo
      ) {
        ordersData = filterOrdersByPickupCriteria(ordersData, filters);
      }

      console.log("✅ Orders loaded and filtered:", ordersData.length);
      setOrders(ordersData);
    } catch (error) {
      console.error("❌ Error loading orders:", error);
      showError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // Load bakers list for admin filtering
  const loadBakers = async () => {
    try {
      const response = await axios.get("/users/bakers");
      setBakers(response.data);
    } catch (error) {
      console.error("Error loading bakers:", error);
      // Don't show error to user as this is not critical
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Helper function to check if a quick filter is currently active
  const isQuickFilterActive = (filterType, value) => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    switch (filterType) {
      case "pickup-orders":
        return (
          filters.stage === "Completed" &&
          filters.deliveryMethod === "Pickup" &&
          !filters.pickupStatus &&
          !filters.pickupDateFrom &&
          !filters.pickupDateTo
        );

      case "pickup-today":
        return (
          filters.stage === "Completed" &&
          filters.deliveryMethod === "Pickup" &&
          filters.pickupStatus === "today" &&
          filters.pickupDateFrom === today &&
          filters.pickupDateTo === today
        );

      case "pickup-overdue":
        return (
          filters.stage === "Completed" &&
          filters.deliveryMethod === "Pickup" &&
          filters.pickupStatus === "overdue" &&
          filters.pickupDateTo === yesterdayStr
        );

      case "pickup-tomorrow":
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        return (
          filters.stage === "Completed" &&
          filters.deliveryMethod === "Pickup" &&
          filters.pickupStatus === "tomorrow" &&
          filters.pickupDateFrom === tomorrowStr &&
          filters.pickupDateTo === tomorrowStr
        );

      case "stage":
        return filters.stage === value && !filters.deliveryMethod;

      case "bakerEmail":
        return filters.bakerEmail === value;

      default:
        return filters[filterType] === value;
    }
  };

  // Enhanced quick filter functions that update dropdown filters too
  const applyQuickFilter = (filterType, value) => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    switch (filterType) {
      case "pickup-orders":
        setFilters((prev) => ({
          ...prev,
          stage: "Completed",
          deliveryMethod: "Pickup",
          pickupStatus: "",
          pickupDateFrom: "",
          pickupDateTo: "",
          // Clear conflicting filters
          paymentMethod: "",
          bakerId: "",
          bakerEmail: "",
          dateFrom: "",
          dateTo: "",
        }));
        break;

      case "pickup-today":
        setFilters((prev) => ({
          ...prev,
          stage: "Completed",
          deliveryMethod: "Pickup",
          pickupStatus: "today",
          // Set pickup date range to today only
          pickupDateFrom: todayStr,
          pickupDateTo: todayStr,
          // Clear conflicting filters but keep other pickup-related ones
          paymentMethod: "",
          bakerId: "",
          bakerEmail: "",
          dateFrom: "",
          dateTo: "",
        }));
        break;

      case "pickup-overdue":
        // For overdue pickups, we want everything from the beginning up to yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        setFilters((prev) => ({
          ...prev,
          stage: "Completed",
          deliveryMethod: "Pickup",
          pickupStatus: "overdue",
          // Set pickup date range to show all dates up to yesterday
          pickupDateFrom: "2020-01-01", // Far past date to capture all overdue
          pickupDateTo: yesterdayStr,
          // Clear conflicting filters but keep other pickup-related ones
          paymentMethod: "",
          bakerId: "",
          bakerEmail: "",
          dateFrom: "",
          dateTo: "",
        }));
        break;

      case "pickup-tomorrow":
        // Add support for tomorrow quick filter
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];

        setFilters((prev) => ({
          ...prev,
          stage: "Completed",
          deliveryMethod: "Pickup",
          pickupStatus: "tomorrow",
          // Set pickup date range to tomorrow only
          pickupDateFrom: tomorrowStr,
          pickupDateTo: tomorrowStr,
          // Clear conflicting filters
          paymentMethod: "",
          bakerId: "",
          bakerEmail: "",
          dateFrom: "",
          dateTo: "",
        }));
        break;

      case "pickup-this-week":
        // Add support for this week quick filter
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

        setFilters((prev) => ({
          ...prev,
          stage: "Completed",
          deliveryMethod: "Pickup",
          pickupStatus: "upcoming",
          // Set pickup date range to this week
          pickupDateFrom: startOfWeek.toISOString().split("T")[0],
          pickupDateTo: endOfWeek.toISOString().split("T")[0],
          // Clear conflicting filters
          paymentMethod: "",
          bakerId: "",
          bakerEmail: "",
          dateFrom: "",
          dateTo: "",
        }));
        break;

      case "stage":
        // When applying stage quick filter, clear pickup-specific filters
        setFilters((prev) => ({
          ...prev,
          stage: value,
          // Clear pickup-specific filters when changing stage
          deliveryMethod: "",
          pickupStatus: "",
          pickupDateFrom: "",
          pickupDateTo: "",
          // Keep other filters
        }));
        break;

      case "bakerEmail":
        // When applying baker filter, clear pickup-specific filters
        setFilters((prev) => ({
          ...prev,
          bakerEmail: value,
          // Clear pickup-specific filters
          pickupStatus: "",
          pickupDateFrom: "",
          pickupDateTo: "",
          // Keep other filters but clear conflicting ones
          bakerId: "",
        }));
        break;

      default:
        // For other quick filters, update the specific filter and clear pickup-specific ones
        setFilters((prev) => ({
          ...prev,
          [filterType]: value,
          pickupStatus: "",
          pickupDateFrom: "",
          pickupDateTo: "",
        }));
        break;
    }
  };

  // FIXED: Enhanced client-side filtering function for pickup criteria
  const filterOrdersByPickupCriteria = (orders, criteria) => {
    let filteredOrders = orders;

    // Filter by pickup status (today, overdue, etc.)
    if (criteria.pickupStatus) {
      filteredOrders = filteredOrders.filter((order) => {
        if (order.deliveryMethod !== "Pickup" || !order.pickupSchedule) {
          return false;
        }

        if (!order.pickupSchedule.date || !order.pickupSchedule.time) {
          return false;
        }

        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const pickupDate = new Date(order.pickupSchedule.date);
        const pickupDateTime = new Date(
          `${order.pickupSchedule.date}T${order.pickupSchedule.time}`
        );

        switch (criteria.pickupStatus) {
          case "today":
            return pickupDate.getTime() === today.getTime();
          case "overdue":
            return pickupDateTime < now;
          case "tomorrow":
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            return pickupDate.getTime() === tomorrow.getTime();
          case "upcoming":
            return pickupDateTime > now;
          default:
            return true;
        }
      });
    }

    // NEW: Filter by pickup date range
    if (criteria.pickupDateFrom || criteria.pickupDateTo) {
      filteredOrders = filteredOrders.filter((order) => {
        if (order.deliveryMethod !== "Pickup" || !order.pickupSchedule?.date) {
          return false;
        }

        const pickupDate = new Date(order.pickupSchedule.date);

        if (criteria.pickupDateFrom) {
          const fromDate = new Date(criteria.pickupDateFrom);
          if (pickupDate < fromDate) return false;
        }

        if (criteria.pickupDateTo) {
          const toDate = new Date(criteria.pickupDateTo);
          // Set to end of day for "to" date
          toDate.setHours(23, 59, 59, 999);
          if (pickupDate > toDate) return false;
        }

        return true;
      });
    }

    return filteredOrders;
  };

  // Enhanced clearAllFilters function
  const clearAllFilters = () => {
    setFilters({
      stage: "",
      bakerId: "",
      bakerEmail: "",
      dateFrom: "",
      dateTo: "",
      deliveryMethod: "",
      paymentMethod: "",
      pickupStatus: "",
      pickupDateFrom: "", // Clear pickup date filters
      pickupDateTo: "", // Clear pickup date filters
    });
  };
  const handleDeleteOrder = async (orderId) => {
    try {
      await axios.delete(`/orders/${orderId}`);
      showSuccess("Order deleted successfully");
      loadOrders();
      setDeleteModal({ isOpen: false, orderId: null });
    } catch (error) {
      console.error("Error deleting order:", error);
      showError(error.response?.data?.message || "Failed to delete order");
    }
  };

  const canDeleteOrder = (order) => {
    if (user.role === "admin") return true;
    if (
      user.role === "baker" &&
      order.bakerId === user.bakerId &&
      (order.stage === "Draft" || order.stage === "Requested Changes")
    ) {
      return true;
    }
    return false;
  };

  // Get unique baker emails for quick filtering
  const uniqueBakerEmails = [
    ...new Set(orders.map((order) => order.bakerEmail)),
  ].sort();

  // Helper function to format pickup status
  const getPickupStatusDisplay = (order) => {
    if (order.deliveryMethod !== "Pickup" || !order.pickupSchedule) {
      return null;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!order.pickupSchedule.date || !order.pickupSchedule.time) {
      return {
        label: "Schedule needed",
        color: "yellow",
        icon: "⚠️",
      };
    }

    const pickupDate = new Date(order.pickupSchedule.date);
    const pickupDateTime = new Date(
      `${order.pickupSchedule.date}T${order.pickupSchedule.time}`
    );

    if (pickupDateTime < now) {
      return {
        label: "Overdue",
        color: "red",
        icon: "🚨",
      };
    } else if (pickupDate.getTime() === today.getTime()) {
      return {
        label: "Today",
        color: "orange",
        icon: "📅",
      };
    } else if (pickupDate.getTime() === today.getTime() + 24 * 60 * 60 * 1000) {
      return {
        label: "Tomorrow",
        color: "blue",
        icon: "📅",
      };
    } else {
      return {
        label: "Scheduled",
        color: "green",
        icon: "✅",
      };
    }
  };

  // Connection status indicator
  const renderConnectionStatus = () => {
    return (
      <div className="flex items-center space-x-2 text-xs">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-gray-500">
          {isConnected ? "Live updates active" : "Offline"}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.role === "admin" ? "All Orders" : "My Orders"}
          </h1>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-gray-600">
              {user.role === "admin"
                ? "Manage all orders in the system"
                : "View and manage your cookie cutter orders"}
            </p>
            {renderConnectionStatus()}
          </div>
        </div>

        {user.role === "baker" && (
          <Link to="/orders/new">
            <Button variant="primary">Create New Order</Button>
          </Link>
        )}
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {orders.length} order{orders.length !== 1 ? "s" : ""} found
            </span>
          </div>
        </div>

        {/* Quick Filter Buttons */}
        {user.role === "admin" && (
          <div className="border-b border-gray-200 pb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Quick Filters:
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => applyQuickFilter("stage", "Completed")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("stage", "Completed")
                    ? "bg-green-100 border-green-300 text-green-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📦 Completed Orders
              </button>

              <button
                onClick={() => applyQuickFilter("stage", "Submitted")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("stage", "Submitted")
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📝 Submitted Orders
              </button>

              <button
                onClick={() => applyQuickFilter("stage", "Requires Approval")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("stage", "Requires Approval")
                    ? "bg-purple-100 border-purple-300 text-purple-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                ⏳ Needs Approval
              </button>

              <button
                onClick={() => applyQuickFilter("pickup-orders")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("pickup-orders")
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                🚶 All Pickup Orders
              </button>

              <button
                onClick={() => applyQuickFilter("pickup-today")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("pickup-today")
                    ? "bg-orange-100 border-orange-300 text-orange-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📅 Pickup Today
              </button>

              <button
                onClick={() => applyQuickFilter("pickup-overdue")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("pickup-overdue")
                    ? "bg-red-100 border-red-300 text-red-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                🚨 Overdue Pickups
              </button>

              {/* Optional: Add more pickup quick filters */}
              <button
                onClick={() => applyQuickFilter("pickup-tomorrow")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("pickup-tomorrow")
                    ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📅 Pickup Tomorrow
              </button>

              <button
                onClick={() => applyQuickFilter("pickup-this-week")}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isQuickFilterActive("pickup-this-week")
                    ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                    : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📆 Pickup This Week
              </button>
            </div>
          </div>
        )}
        {/* Baker Quick Filters */}
        {user.role === "admin" && uniqueBakerEmails.length > 0 && (
          <div className="border-b border-gray-200 pb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Quick Filter by Baker:
            </h4>
            <div className="flex flex-wrap gap-2">
              {uniqueBakerEmails.slice(0, 5).map((email) => (
                <button
                  key={email}
                  onClick={() => applyQuickFilter("bakerEmail", email)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    isQuickFilterActive("bakerEmail", email)
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {email}
                </button>
              ))}
              {uniqueBakerEmails.length > 5 && (
                <span className="text-xs text-gray-500 px-2 py-1">
                  +{uniqueBakerEmails.length - 5} more...
                </span>
              )}
            </div>
          </div>
        )}

        {/* Detailed Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Stage Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stage
            </label>
            <select
              value={filters.stage}
              onChange={(e) => handleFilterChange("stage", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stages</option>
              {Object.values(ORDER_STAGES).map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Status Filter (Admin only) - Show when pickup delivery method is selected */}
          {user.role === "admin" && filters.deliveryMethod === "Pickup" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Status
              </label>
              <select
                value={filters.pickupStatus}
                onChange={(e) =>
                  handleFilterChange("pickupStatus", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Pickup Orders</option>
                <option value="today">Today</option>
                <option value="overdue">Overdue</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
          )}

          {/* Baker ID Filter (Admin only) */}
          {user.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Baker ID
              </label>
              <input
                type="text"
                value={filters.bakerId}
                onChange={(e) => handleFilterChange("bakerId", e.target.value)}
                placeholder="e.g., B001"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Baker Email Filter (Admin only) */}
          {user.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Baker Email
              </label>
              <select
                value={filters.bakerEmail}
                onChange={(e) =>
                  handleFilterChange("bakerEmail", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Bakers</option>
                {bakers.map((baker) => (
                  <option key={baker._id} value={baker.email}>
                    {baker.email} ({baker.bakerId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Delivery Method Filter (Admin only) */}
          {user.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Method
              </label>
              <select
                value={filters.deliveryMethod}
                onChange={(e) =>
                  handleFilterChange("deliveryMethod", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Methods</option>
                {Object.values(DELIVERY_METHODS).map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Method Filter (Admin only) */}
          {user.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) =>
                  handleFilterChange("paymentMethod", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Methods</option>
                {Object.values(PAYMENT_METHODS).map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date To
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* NEW: Pickup Date From Filter (Admin only) */}
          {user.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Date From
              </label>
              <input
                type="date"
                value={filters.pickupDateFrom}
                onChange={(e) =>
                  handleFilterChange("pickupDateFrom", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* NEW: Pickup Date To Filter (Admin only) */}
          {user.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Date To
              </label>
              <input
                type="date"
                value={filters.pickupDateTo}
                onChange={(e) =>
                  handleFilterChange("pickupDateTo", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {Object.values(filters).some((filter) => filter) && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Active filters:</span>

                {filters.stage && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Stage: {filters.stage}
                    <button
                      onClick={() => handleFilterChange("stage", "")}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {filters.bakerId && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Baker ID: {filters.bakerId}
                    <button
                      onClick={() => handleFilterChange("bakerId", "")}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {filters.bakerEmail && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Baker: {filters.bakerEmail}
                    <button
                      onClick={() => handleFilterChange("bakerEmail", "")}
                      className="ml-1 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {filters.deliveryMethod && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Delivery: {filters.deliveryMethod}
                    <button
                      onClick={() => handleFilterChange("deliveryMethod", "")}
                      className="ml-1 text-indigo-600 hover:text-indigo-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {filters.paymentMethod && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                    Payment: {filters.paymentMethod}
                    <button
                      onClick={() => handleFilterChange("paymentMethod", "")}
                      className="ml-1 text-pink-600 hover:text-pink-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {filters.pickupStatus && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Pickup: {filters.pickupStatus}
                    <button
                      onClick={() => handleFilterChange("pickupStatus", "")}
                      className="ml-1 text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {(filters.dateFrom || filters.dateTo) && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Due Date Range
                    {filters.dateFrom && ` from ${filters.dateFrom}`}
                    {filters.dateTo && ` to ${filters.dateTo}`}
                    <button
                      onClick={() => {
                        handleFilterChange("dateFrom", "");
                        handleFilterChange("dateTo", "");
                      }}
                      className="ml-1 text-yellow-600 hover:text-yellow-800"
                    >
                      ×
                    </button>
                  </span>
                )}

                {/* Enhanced Pickup Date Range Active Filter */}
                {(filters.pickupDateFrom || filters.pickupDateTo) && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                    Pickup Date:
                    {filters.pickupDateFrom && filters.pickupDateTo ? (
                      filters.pickupDateFrom === filters.pickupDateTo ? (
                        ` ${filters.pickupDateFrom}`
                      ) : (
                        ` ${filters.pickupDateFrom} to ${filters.pickupDateTo}`
                      )
                    ) : (
                      <>
                        {filters.pickupDateFrom &&
                          ` from ${filters.pickupDateFrom}`}
                        {filters.pickupDateTo && ` to ${filters.pickupDateTo}`}
                      </>
                    )}
                    <button
                      onClick={() => {
                        handleFilterChange("pickupDateFrom", "");
                        handleFilterChange("pickupDateTo", "");
                      }}
                      className="ml-1 text-teal-600 hover:text-teal-800"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <Button variant="outline" size="small" onClick={clearAllFilters}>
                Clear All
              </Button>
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadOrders}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">📋</span>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No orders found
            </h3>
            <p className="text-gray-600 mb-4">
              {Object.values(filters).some((filter) => filter)
                ? "No orders match your current filters."
                : user.role === "baker"
                ? "You haven't created any orders yet."
                : "No orders have been created yet."}
            </p>
            {user.role === "baker" &&
              !Object.values(filters).some((filter) => filter) && (
                <Link to="/orders/new">
                  <Button variant="primary">Create Your First Order</Button>
                </Link>
              )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Details
                  </th>
                  {user.role === "admin" && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Baker
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  {user.role === "admin" && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Details
                    </th>
                  )}
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const pickupStatus = getPickupStatusDisplay(order);

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            Created {formatDate(order.createdAt)}
                          </div>
                        </div>
                      </td>

                      {user.role === "admin" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {order.bakerId}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.bakerEmail}
                          </div>
                        </td>
                      )}

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.dateRequired)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`
                            inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            bg-${getStageColor(
                              order.stage
                            )}-100 text-${getStageColor(order.stage)}-800
                          `}
                        >
                          {order.stage}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.items.length} item
                        {order.items.length !== 1 ? "s" : ""}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.price ? `${order.price.toFixed(2)}` : "-"}
                      </td>

                      {user.role === "admin" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            {order.deliveryMethod && (
                              <div className="flex items-center space-x-1 mb-1">
                                <span className="text-gray-900">
                                  {order.deliveryMethod === "Pickup"
                                    ? "🚶"
                                    : "🚚"}
                                </span>
                                <span className="text-gray-900 font-medium">
                                  {order.deliveryMethod}
                                </span>
                                {/* Show international flag for non-Australian deliveries */}
                                {order.deliveryMethod === "Delivery" &&
                                  order.deliveryAddress?.country &&
                                  order.deliveryAddress.country !==
                                    "Australia" && (
                                    <span className="text-blue-600 text-xs">
                                      🌍 INTL
                                    </span>
                                  )}
                              </div>
                            )}

                            {/* Pickup Details */}
                            {order.deliveryMethod === "Pickup" &&
                              order.pickupSchedule && (
                                <div className="text-xs text-gray-600 ml-6">
                                  {order.pickupSchedule.date &&
                                  order.pickupSchedule.time ? (
                                    <>
                                      📅 {formatDate(order.pickupSchedule.date)}{" "}
                                      at {order.pickupSchedule.time}
                                      {pickupStatus && (
                                        <div className="mt-1">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-${pickupStatus.color}-100 text-${pickupStatus.color}-800`}
                                          >
                                            {pickupStatus.icon}{" "}
                                            {pickupStatus.label}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-yellow-600">
                                      ⚠️ Pickup time not set
                                    </span>
                                  )}
                                </div>
                              )}

                            {/* Delivery Details - Enhanced for International */}
                            {order.deliveryMethod === "Delivery" &&
                              order.deliveryAddress && (
                                <div className="text-xs text-gray-600 ml-6">
                                  {order.deliveryAddress.street &&
                                  order.deliveryAddress.suburb &&
                                  order.deliveryAddress.state &&
                                  order.deliveryAddress.postcode &&
                                  order.deliveryAddress.country ? (
                                    <div>
                                      {/* Show flag or indicator for country */}
                                      <div className="flex items-center space-x-1 mb-1">
                                        {order.deliveryAddress.country !==
                                          "Australia" && (
                                          <span className="text-blue-600">
                                            🌍
                                          </span>
                                        )}
                                        <span className="font-medium">
                                          {order.deliveryAddress.country}
                                        </span>
                                      </div>
                                      🏠 {order.deliveryAddress.street}
                                      <br />
                                      {order.deliveryAddress.suburb}{" "}
                                      {order.deliveryAddress.state}{" "}
                                      {order.deliveryAddress.postcode}
                                      {/* Show international delivery notice */}
                                      {order.deliveryAddress.country !==
                                        "Australia" && (
                                        <div className="mt-1 text-blue-600 font-medium">
                                          International Delivery
                                        </div>
                                      )}
                                      {order.deliveryAddress.instructions && (
                                        <div className="mt-1 text-gray-500 italic">
                                          "
                                          {order.deliveryAddress.instructions
                                            .length > 30
                                            ? order.deliveryAddress.instructions.substring(
                                                0,
                                                30
                                              ) + "..."
                                            : order.deliveryAddress
                                                .instructions}
                                          "
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-yellow-600">
                                      ⚠️ Delivery address not set
                                    </span>
                                  )}
                                </div>
                              )}

                            {/* Payment Method - Enhanced for International */}
                            {order.paymentMethod && (
                              <div className="text-xs text-gray-500 mt-2 ml-6">
                                {order.paymentMethod === "Cash" ? "💵" : "💳"}{" "}
                                {order.paymentMethod}
                                {order.paymentMethod === "Cash" &&
                                  order.price && (
                                    <span className="text-yellow-600">
                                      {" "}
                                      (Exact: ${order.price.toFixed(2)})
                                    </span>
                                  )}
                                {order.paymentMethod === "Card" && (
                                  <span className="text-blue-600">
                                    {" "}
                                    (Invoice sent)
                                  </span>
                                )}
                                {/* International delivery payment notice */}
                                {order.deliveryMethod === "Delivery" &&
                                  order.deliveryAddress?.country &&
                                  order.deliveryAddress.country !==
                                    "Australia" && (
                                    <div className="text-orange-600 mt-1">
                                      + International shipping fees
                                    </div>
                                  )}
                              </div>
                            )}

                            {/* No details provided */}
                            {!order.deliveryMethod &&
                              order.stage === "Completed" && (
                                <span className="text-xs text-red-600">
                                  ⚠️ Collection details needed
                                </span>
                              )}
                          </div>
                        </td>
                      )}

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Link
                          to={`/orders/${order._id}`}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          View
                        </Link>

                        {canDeleteOrder(order) && (
                          <button
                            onClick={() =>
                              setDeleteModal({
                                isOpen: true,
                                orderId: order._id,
                              })
                            }
                            className="text-red-600 hover:text-red-900 ml-2 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, orderId: null })}
        title="Delete Order"
        size="medium"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete this order? This action cannot be
            undone.
          </p>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, orderId: null })}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDeleteOrder(deleteModal.orderId)}
            >
              Delete Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Orders;
