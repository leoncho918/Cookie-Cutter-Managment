// src/contexts/AuthContext.js - Authentication context provider
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

  // Add axios interceptor to handle first login enforcement
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 403 &&
          error.response?.data?.requiresPasswordChange
        ) {
          // Force redirect to password change
          window.location.href = "/first-login";
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Set auth token in axios headers
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Check for existing token on app load
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("token");

      if (storedToken) {
        try {
          // Verify token with server by fetching user profile
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${storedToken}`;
          const response = await axios.get("/users/profile");

          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          console.error("Token verification failed:", error);
          localStorage.removeItem("token");
          delete axios.defaults.headers.common["Authorization"];
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Login function - Updated to handle first login enforcement
  const login = async (email, password) => {
    try {
      const response = await axios.post("/auth/login", { email, password });
      const {
        token: newToken,
        user: userData,
        requiresPasswordChange,
      } = response.data;

      localStorage.setItem("token", newToken);
      setToken(newToken);
      setUser(userData);

      return {
        success: true,
        user: userData,
        requiresPasswordChange, // ← Pass this to the frontend
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      // Update user's first login status
      setUser((prevUser) => ({
        ...prevUser,
        isFirstLogin: false,
      }));

      return { success: true };
    } catch (error) {
      console.error("Change password error:", error);
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

  // Check if user needs to change password (for existing sessions)
  const checkPasswordChangeRequired = async () => {
    try {
      // Make a request to any protected endpoint to check status
      await axios.get("/users/profile");
      return false; // If successful, no password change required
    } catch (error) {
      if (
        error.response?.status === 403 &&
        error.response?.data?.requiresPasswordChange
      ) {
        return true; // Password change required
      }
      return false;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    changePassword,
    resetPassword,
    checkPasswordChangeRequired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
