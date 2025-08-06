// frontend/src/App.js - FIXED App component with proper first login handling
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SocketProvider } from "./contexts/SocketContext";
import Navbar from "./components/Layout/Navbar";
import Sidebar from "./components/Layout/Sidebar";
import Login from "./components/Auth/Login";
import ChangePassword from "./components/Auth/ChangePassword";
import Dashboard from "./components/Dashboard/Dashboard";
import Orders from "./components/Orders/Orders";
import OrderDetail from "./components/Orders/OrderDetail";
import CreateOrder from "./components/Orders/CreateOrder";
import UserManagement from "./components/Admin/UserManagement";
import LoadingSpinner from "./components/UI/LoadingSpinner";
import Toast from "./components/UI/Toast";
import "./App.css";

// FIXED: Protected Route Component with proper first login enforcement
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // CRITICAL: Check for first login requirement
  console.log("🔍 ProtectedRoute check:", {
    email: user.email,
    isFirstLogin: user.isFirstLogin,
    currentPath: window.location.pathname,
  });

  if (user.isFirstLogin) {
    console.log(
      "🚨 User needs to change password - redirecting to first-login"
    );
    return <Navigate to="/first-login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Main App Layout Component
const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

// FIXED: First Login Handler Component
const FirstLoginHandler = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!user) {
    console.log("🚨 No user found in FirstLoginHandler - redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // If user is NOT on first login, redirect to dashboard
  if (!user.isFirstLogin) {
    console.log(
      "✅ User has already changed password - redirecting to dashboard"
    );
    return <Navigate to="/dashboard" replace />;
  }

  console.log("🔒 Showing password change form for first login");
  return <ChangePassword isFirstLogin={true} />;
};

// Main App Component
function App() {
  return (
    <div className="App">
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Router>
              <AppContent />
            </Router>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </div>
  );
}

// FIXED: App Content Component with better routing logic
const AppContent = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            user ? (
              user.isFirstLogin ? (
                <Navigate to="/first-login" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Login />
            )
          }
        />

        {/* First Login Route - CRITICAL for password changes */}
        <Route path="/first-login" element={<FirstLoginHandler />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <OrderDetail />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/new"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CreateOrder />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Orders />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ChangePassword />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin Only Routes */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly={true}>
              <AppLayout>
                <UserManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route
          path="/"
          element={
            user ? (
              user.isFirstLogin ? (
                <Navigate to="/first-login" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 404 Route */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <div className="text-center py-8">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Page Not Found
                  </h1>
                  <p className="text-gray-600 mt-2">
                    The page you're looking for doesn't exist.
                  </p>
                </div>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toast />
    </>
  );
};

export default App;
