// src/components/Dashboard/Dashboard.js - Main dashboard component
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useApi } from "../../hooks/useApi";
import {
  ORDER_STAGES,
  getStageColor,
  formatDate,
} from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import axios from "axios";

const Dashboard = () => {
  const { user } = useAuth();
  const { showError } = useToast();
  const { loading, apiCall } = useApi();

  const [dashboardData, setDashboardData] = useState({
    recentOrders: [],
    stats: {},
    loading: true,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load recent orders
      const ordersResponse = await axios.get("/orders", {
        params: { limit: 5 },
      });

      let stats = {};

      // Load statistics for admin
      if (user.role === "admin") {
        const statsResponse = await axios.get("/orders/stats/overview");
        stats = statsResponse.data;
      }

      setDashboardData({
        recentOrders: ordersResponse.data.slice(0, 5),
        stats,
        loading: false,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      showError("Failed to load dashboard data");
      setDashboardData((prev) => ({ ...prev, loading: false }));
    }
  };

  const getStageStats = () => {
    const { recentOrders } = dashboardData;
    const stageCounts = {};

    Object.values(ORDER_STAGES).forEach((stage) => {
      stageCounts[stage] = recentOrders.filter(
        (order) => order.stage === stage
      ).length;
    });

    return stageCounts;
  };

  const getQuickActions = () => {
    const actions = [];

    if (user.role === "baker") {
      actions.push(
        {
          title: "Create New Order",
          description: "Start a new cookie cutter order",
          href: "/orders/new",
          icon: "➕",
          color: "blue",
        },
        {
          title: "My Orders",
          description: "View and manage your orders",
          href: "/orders",
          icon: "📋",
          color: "green",
        }
      );
    }

    if (user.role === "admin") {
      actions.push(
        {
          title: "All Orders",
          description: "Manage all orders in the system",
          href: "/orders",
          icon: "📋",
          color: "blue",
        },
        {
          title: "User Management",
          description: "Manage baker accounts",
          href: "/admin/users",
          icon: "👥",
          color: "purple",
        }
      );
    }

    return actions;
  };

  if (dashboardData.loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const PickupScheduleList = () => {
    const [pickupOrders, setPickupOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showError } = useToast();

    useEffect(() => {
      loadPickupOrders();
    }, []);

    const loadPickupOrders = async () => {
      try {
        setLoading(true);

        // Get completed orders with pickup method
        const response = await axios.get("/orders", {
          params: {
            stage: "Completed",
          },
        });

        // Filter orders with pickup method and sort by pickup date
        const ordersWithPickup = response.data
          .filter(
            (order) =>
              order.deliveryMethod === "Pickup" &&
              order.pickupSchedule &&
              order.pickupSchedule.date
          )
          .sort((a, b) => {
            const dateA = parsePickupDateTime(a.pickupSchedule);
            const dateB = parsePickupDateTime(b.pickupSchedule);

            if (!dateA) return 1;
            if (!dateB) return -1;

            return dateA - dateB;
          });

        setPickupOrders(ordersWithPickup);
      } catch (error) {
        console.error("Error loading pickup orders:", error);
        showError("Failed to load pickup schedules");
      } finally {
        setLoading(false);
      }
    };

    // FIXED: Enhanced date parsing function
    const parsePickupDateTime = (pickupSchedule) => {
      if (!pickupSchedule || !pickupSchedule.date || !pickupSchedule.time) {
        return null;
      }

      try {
        let pickupDate;
        const dateValue = pickupSchedule.date;

        // Handle different date formats (same logic as Orders page)
        if (typeof dateValue === "string") {
          if (dateValue.includes("T")) {
            // ISO string format: "2025-08-07T00:00:00.000Z"
            pickupDate = new Date(dateValue);
          } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Date string format: "2025-08-07"
            pickupDate = new Date(dateValue + "T00:00:00");
          } else if (dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            // DD/MM/YYYY format
            const [day, month, year] = dateValue.split("/");
            pickupDate = new Date(year, month - 1, day);
          } else if (dateValue.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
            // YYYY/MM/DD format
            const [year, month, day] = dateValue.split("/");
            pickupDate = new Date(year, month - 1, day);
          } else {
            pickupDate = new Date(dateValue);
          }
        } else {
          pickupDate = new Date(dateValue);
        }

        if (isNaN(pickupDate.getTime())) {
          console.warn("Invalid pickup date in dashboard:", dateValue);
          return null;
        }

        // Normalize time format
        let normalizedTime = pickupSchedule.time.trim();

        // Handle 12-hour format (convert to 24-hour)
        if (
          normalizedTime.toLowerCase().includes("am") ||
          normalizedTime.toLowerCase().includes("pm")
        ) {
          const timeRegex = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i;
          const match = normalizedTime.match(timeRegex);
          if (match) {
            let hours = parseInt(match[1]);
            const minutes = match[2];
            const ampm = match[3].toLowerCase();

            if (ampm === "pm" && hours !== 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;

            normalizedTime = `${hours.toString().padStart(2, "0")}:${minutes}`;
          }
        }

        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(normalizedTime)) {
          console.warn(
            "Invalid pickup time in dashboard:",
            pickupSchedule.time
          );
          return null;
        }

        // Create the combined datetime
        const dateString = pickupDate.toISOString().split("T")[0];
        const pickupDateTime = new Date(`${dateString}T${normalizedTime}:00`);

        if (isNaN(pickupDateTime.getTime())) {
          console.warn(
            "Invalid pickup datetime in dashboard:",
            dateString,
            normalizedTime
          );
          return null;
        }

        return pickupDateTime;
      } catch (error) {
        console.error("Error parsing pickup datetime in dashboard:", error);
        return null;
      }
    };

    const formatPickupDateTime = (pickupSchedule) => {
      if (!pickupSchedule || !pickupSchedule.date) return "Not scheduled";

      try {
        const pickupDate = parsePickupDateTime(pickupSchedule);
        if (!pickupDate) return "Invalid date/time";

        const date = pickupDate.toLocaleDateString("en-AU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        const time = pickupSchedule.time || "Time not set";

        return `${date} at ${time}`;
      } catch (error) {
        console.error("Error formatting pickup datetime:", error);
        return "Error formatting date";
      }
    };

    // FIXED: Enhanced pickup status calculation (same logic as Orders page)
    const getPickupStatus = (pickupSchedule) => {
      if (!pickupSchedule || !pickupSchedule.date || !pickupSchedule.time) {
        return {
          status: "incomplete",
          color: "yellow",
          label: "Incomplete Details",
        };
      }

      try {
        const pickupDateTime = parsePickupDateTime(pickupSchedule);
        if (!pickupDateTime) {
          return {
            status: "invalid",
            color: "red",
            label: "Invalid Date/Time",
          };
        }

        const now = new Date();

        // Get today and tomorrow at midnight for accurate comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get pickup date at midnight for date-only comparison
        const pickupDateOnly = new Date(pickupDateTime);
        pickupDateOnly.setHours(0, 0, 0, 0);

        console.log("🔍 Dashboard pickup status debug:", {
          orderPickupSchedule: pickupSchedule,
          now: now.toISOString(),
          today: today.toISOString(),
          tomorrow: tomorrow.toISOString(),
          pickupDateTime: pickupDateTime.toISOString(),
          pickupDateOnly: pickupDateOnly.toISOString(),
          todayTime: today.getTime(),
          tomorrowTime: tomorrow.getTime(),
          pickupDateOnlyTime: pickupDateOnly.getTime(),
        });

        // Check if overdue (pickup time has passed)
        if (pickupDateTime < now) {
          return { status: "overdue", color: "red", label: "Overdue" };
        }

        // Check if today
        if (pickupDateOnly.getTime() === today.getTime()) {
          return { status: "today", color: "orange", label: "Today" };
        }

        // Check if tomorrow
        if (pickupDateOnly.getTime() === tomorrow.getTime()) {
          return { status: "tomorrow", color: "yellow", label: "Tomorrow" };
        }

        // All other future dates
        return { status: "upcoming", color: "green", label: "Upcoming" };
      } catch (error) {
        console.error("Error calculating pickup status in dashboard:", error);
        return {
          status: "error",
          color: "red",
          label: "Error",
        };
      }
    };

    if (loading) {
      return (
        <div className="p-6">
          <LoadingSpinner size="medium" />
        </div>
      );
    }

    if (pickupOrders.length === 0) {
      return (
        <div className="p-6 text-center">
          <span className="text-4xl mb-4 block">📅</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Pickup Orders
          </h3>
          <p className="text-gray-600">
            No completed orders are scheduled for pickup at this time.
          </p>
        </div>
      );
    }

    return (
      <div className="p-6">
        <div className="space-y-4">
          {pickupOrders.slice(0, 5).map((order) => {
            const pickupStatus = getPickupStatus(order.pickupSchedule);

            return (
              <div
                key={order._id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Link
                      to={`/orders/${order._id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {order.orderNumber}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${pickupStatus.color}-100 text-${pickupStatus.color}-800`}
                    >
                      {pickupStatus.label}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    <span className="font-medium">{order.bakerEmail}</span>
                    <span className="mx-2">•</span>
                    <span>
                      {order.items.length} item
                      {order.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatPickupDateTime(order.pickupSchedule)}
                  </div>
                  {order.pickupSchedule?.notes && (
                    <div className="text-xs text-gray-500 mt-1 max-w-48 truncate">
                      "{order.pickupSchedule.notes}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {pickupOrders.length > 5 && (
          <div className="mt-4 text-center">
            <Link
              to="/orders?stage=Completed"
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              View all pickup orders →
            </Link>
          </div>
        )}
      </div>
    );
  };

  const quickActions = getQuickActions();
  const stageStats = getStageStats();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.email}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {user.role === "admin"
              ? "Manage orders and baker accounts from your admin dashboard."
              : `Baker ID: ${user.bakerId} - Create and track your cookie cutter orders.`}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action, index) => (
          <Link
            key={index}
            to={action.href}
            className={`
                            relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-${action.color}-500 
                            hover:bg-gray-50 rounded-lg shadow transition-all duration-200 hover:shadow-md
                        `}
          >
            <div>
              <span
                className={`
                                rounded-lg inline-flex p-3 bg-${action.color}-50 text-${action.color}-600 ring-4 ring-white
                            `}
              >
                <span className="text-2xl">{action.icon}</span>
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-gray-800">
                {action.title}
              </h3>
              <p className="mt-2 text-sm text-gray-500">{action.description}</p>
            </div>
            <span
              className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
              aria-hidden="true"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      {/* Statistics Section - Admin Only */}
      {user.role === "admin" && dashboardData.stats && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Order Statistics
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {dashboardData.stats.totalOrders || 0}
                </div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardData.stats.completedOrders || 0}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {dashboardData.stats.activeOrders || 0}
                </div>
                <div className="text-sm text-gray-600">Active Orders</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(dashboardData.stats.stageBreakdown &&
                    dashboardData.stats.stageBreakdown[
                      ORDER_STAGES.REQUIRES_APPROVAL
                    ]) ||
                    0}
                </div>
                <div className="text-sm text-gray-600">Needs Approval</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Orders</h2>
            <Link
              to="/orders"
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              View all orders →
            </Link>
          </div>

          {dashboardData.recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">📋</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No orders yet
              </h3>
              <p className="text-gray-600 mb-4">
                {user.role === "baker"
                  ? "You haven't created any orders yet."
                  : "No orders have been created yet."}
              </p>
              {user.role === "baker" && (
                <Button
                  variant="primary"
                  onClick={() => (window.location.href = "/orders/new")}
                >
                  Create Your First Order
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
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
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dashboardData.recentOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.orderNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          Created {formatDate(order.createdAt)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/orders/${order._id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pickup Schedule Section - Admin Only */}
      {user.role === "admin" && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              📅 Upcoming Pickups
            </h3>
          </div>

          <PickupScheduleList />
        </div>
      )}

      {/* Baker-specific order stage summary */}
      {user.role === "baker" && dashboardData.recentOrders.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Your Orders by Status
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(stageStats).map(
                ([stage, count]) =>
                  count > 0 && (
                    <div
                      key={stage}
                      className={`
                                        bg-${getStageColor(
                                          stage
                                        )}-50 p-3 rounded-lg text-center
                                    `}
                    >
                      <div
                        className={`text-lg font-bold text-${getStageColor(
                          stage
                        )}-600`}
                      >
                        {count}
                      </div>
                      <div className="text-xs text-gray-600">{stage}</div>
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
