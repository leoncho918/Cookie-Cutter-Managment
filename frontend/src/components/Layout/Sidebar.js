// src/components/Layout/Sidebar.js - Updated side navigation menu with settings
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: "📊" },
    { name: "Orders", href: "/orders", icon: "📋" },
    { name: "Create Order", href: "/orders/new", icon: "➕", bakerOnly: true },
    {
      name: "User Management",
      href: "/admin/users",
      icon: "👥",
      adminOnly: true,
    },
    {
      name: "Update Requests", // Add this new menu item
      href: "/admin/update-requests",
      icon: "📝",
      adminOnly: true,
    },
    {
      name: "System Settings", // NEW: Settings menu item
      href: "/admin/settings",
      icon: "⚙️",
      adminOnly: true,
    },
    { name: "Change Password", href: "/change-password", icon: "🔒" },
  ];

  const filteredNavigation = navigation.filter((item) => {
    if (item.adminOnly && user?.role !== "admin") return false;
    if (item.bakerOnly && user?.role !== "baker") return false;
    return true;
  });

  const isCurrentPath = (href) => location.pathname === href;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 lg:hidden z-20"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out
                lg:translate-x-0 lg:static lg:inset-0
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
            `}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <span className="text-lg font-semibold text-gray-900">Menu</span>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => onClose()}
                className={`
                                    group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                                    ${
                                      isCurrentPath(item.href)
                                        ? "bg-blue-100 text-blue-700 border-r-2 border-blue-700"
                                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    }
                                `}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
                {/* NEW: Show badge for settings if user is admin */}
                {item.href === "/admin/settings" && user?.role === "admin" && (
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Admin
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* NEW: Settings section separator for admin */}
          {user?.role === "admin" && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Administration
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-500 px-3 py-1">
                  🌍 International delivery settings
                </div>
                <div className="text-xs text-gray-500 px-3 py-1">
                  ⚙️ System configuration
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
