// src/components/Orders/Orders.js - Main orders list component
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
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
  const { showError, showSuccess } = useToast();

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

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await axios.get(`/orders?${params.toString()}`);
      setOrders(response.data);
    } catch (error) {
      console.error("Error loading orders:", error);
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
          <p className="text-gray-600 mt-1">
            {user.role === "admin"
              ? "Manage all orders in the system"
              : "View and manage your cookie cutter orders"}
          </p>
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
                  <tr key={order._id} className="hover:bg-gray-50">
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
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>

                      {canDeleteOrder(order) && (
                        <button
                          onClick={() =>
                            setDeleteModal({ isOpen: true, orderId: order._id })
                          }
                          className="text-red-600 hover:text-red-900 ml-2"
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
