// src/App.js - Main React application component
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
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

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/dashboard" />;
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

// First Login Handler Component
const FirstLoginHandler = () => {
  const { user } = useAuth();

  if (user?.isFirstLogin) {
    return <ChangePassword isFirstLogin={true} />;
  }

  return <Navigate to="/dashboard" />;
};

// Main App Component
function App() {
  return (
    <div className="App">
      <AuthProvider>
        <ToastProvider>
          <Router>
            <AppContent />
          </Router>
        </ToastProvider>
      </AuthProvider>
    </div>
  );
}

// App Content Component (separated to use hooks)
const AppContent = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" /> : <Login />}
        />

        {/* First Login Route */}
        <Route
          path="/first-login"
          element={
            <ProtectedRoute>
              <FirstLoginHandler />
            </ProtectedRoute>
          }
        />

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
        <Route path="/" element={<Navigate to="/dashboard" />} />

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
