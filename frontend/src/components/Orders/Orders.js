// src/components/Orders/Orders.js - Enhanced Orders list with real-time updates
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import {
  ORDER_STAGES,
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
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    stage: "",
    bakerId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    orderId: null,
  });

  useEffect(() => {
    loadOrders();
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

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      console.log("🔄 Loading orders with filters:", filters);
      const response = await axios.get(`/orders?${params.toString()}`);
      console.log("✅ Orders loaded:", response.data.length);
      setOrders(response.data);
    } catch (error) {
      console.error("❌ Error loading orders:", error);
      showError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
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
      order.stage === "Draft"
    ) {
      return true;
    }
    return false;
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

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Baker Filter (Admin only) */}
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() =>
              setFilters({ stage: "", bakerId: "", dateFrom: "", dateTo: "" })
            }
          >
            Clear Filters
          </Button>
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
              {filters.stage ||
              filters.bakerId ||
              filters.dateFrom ||
              filters.dateTo
                ? "No orders match your current filters."
                : user.role === "baker"
                ? "You haven't created any orders yet."
                : "No orders have been created yet."}
            </p>
            {user.role === "baker" && (
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
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
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
                                                )}-100 text-${getStageColor(
                          order.stage
                        )}-800
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
                      {order.price ? `$${order.price.toFixed(2)}` : "-"}
                    </td>

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
                            setDeleteModal({ isOpen: true, orderId: order._id })
                          }
                          className="text-red-600 hover:text-red-900 ml-2 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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
