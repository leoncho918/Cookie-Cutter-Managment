// src/components/Auth/ChangePassword.js - Password change form component
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Button from "../UI/Button";

const ChangePassword = ({ isFirstLogin = false }) => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const { changePassword, user } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (
      !formData.currentPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      showError("Please fill in all fields");
      return false;
    }

    if (formData.newPassword.length < 6) {
      showError("New password must be at least 6 characters long");
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showError("New passwords do not match");
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      showError("New password must be different from current password");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const result = await changePassword(
        formData.currentPassword,
        formData.newPassword
      );

      if (result.success) {
        showSuccess("Password changed successfully");

        // Reset form
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Navigate based on context
        if (isFirstLogin) {
          navigate("/dashboard");
        } else {
          navigate(-1); // Go back to previous page
        }
      } else {
        showError(result.message);
      }
    } catch (error) {
      showError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const pageTitle = isFirstLogin ? "Set Your New Password" : "Change Password";
  const pageDescription = isFirstLogin
    ? "Please set a new password for your account to continue."
    : "Update your account password.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {pageTitle}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {pageDescription}
          </p>
          {isFirstLogin && (
            <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-700">
                <strong>First Login:</strong> You must change your password
                before continuing.
              </p>
            </div>
          )}
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                value={formData.currentPassword}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your current password"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700"
              >
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                value={formData.newPassword}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your new password (min 6 characters)"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm your new password"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex space-x-4">
            {!isFirstLogin && (
              <Button
                type="button"
                variant="outline"
                size="large"
                onClick={() => navigate(-1)}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="large"
              loading={isLoading}
              disabled={isLoading}
              className={isFirstLogin ? "w-full" : "flex-1"}
            >
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
