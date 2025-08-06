// frontend/src/contexts/AuthContext.js - FIXED Authentication context
import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Configure axios defaults
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";
axios.defaults.baseURL = API_BASE_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // REMOVED: The problematic interceptor that was causing redirect loops
  // We'll handle first login enforcement in the App.js routing instead

  // Set auth token in axios headers
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // FIXED: Check for existing token on app load
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("token");

      if (storedToken) {
        try {
          // Set token first
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${storedToken}`;

          // Try to fetch user profile
          const response = await axios.get("/users/profile");

          console.log("✅ Token verified, user data:", response.data);
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          console.error("❌ Token verification failed:", error);

          // Clear invalid token
          localStorage.removeItem("token");
          delete axios.defaults.headers.common["Authorization"];
          setToken(null);
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // FIXED: Login function with better error handling
  const login = async (email, password) => {
    try {
      console.log("🔐 Attempting login for:", email);

      const response = await axios.post("/auth/login", { email, password });
      const {
        token: newToken,
        user: userData,
        requiresPasswordChange,
      } = response.data;

      console.log("✅ Login successful:", {
        email: userData.email,
        role: userData.role,
        isFirstLogin: userData.isFirstLogin,
        requiresPasswordChange,
      });

      // Store token and set user data
      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(userData);

      return {
        success: true,
        user: userData,
        requiresPasswordChange: userData.isFirstLogin || requiresPasswordChange,
      };
    } catch (error) {
      console.error("❌ Login error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    }
  };

  // Logout function
  const logout = () => {
    console.log("🚪 Logging out user");
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  // FIXED: Change password function with better state management
  const changePassword = async (currentPassword, newPassword) => {
    try {
      console.log("🔒 Changing password for user:", user?.email);

      await axios.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      // IMPORTANT: Update user's first login status immediately
      setUser((prevUser) => ({
        ...prevUser,
        isFirstLogin: false,
      }));

      console.log("✅ Password changed successfully");
      return { success: true };
    } catch (error) {
      console.error("❌ Change password error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Password change failed",
      };
    }
  };

  // Reset password function (Admin only)
  const resetPassword = async (userId) => {
    try {
      await axios.post("/auth/reset-password", { userId });
      return { success: true };
    } catch (error) {
      console.error("Reset password error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Password reset failed",
      };
    }
  };

  // REMOVED: checkPasswordChangeRequired function as it's not needed with the new approach

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    changePassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
