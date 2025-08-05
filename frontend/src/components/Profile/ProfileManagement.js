// src/components/Profile/ProfileManagement.js - Profile management component for users
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { formatDate } from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import axios from "axios";

const ProfileManagement = () => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    role: "",
    bakerId: "",
    isActive: true,
    createdAt: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/users/profile");
      const userData = response.data;

      setProfile({
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        phoneNumber: userData.phoneNumber || "",
        email: userData.email || "",
        role: userData.role || "",
        bakerId: userData.bakerId || "",
        isActive: userData.isActive || false,
        createdAt: userData.createdAt || "",
      });

      setEditForm({
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        phoneNumber: userData.phoneNumber || "",
      });
    } catch (error) {
      console.error("Error loading profile:", error);
      showError("Failed to load profile information");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const { firstName, lastName, phoneNumber } = editForm;

    if (!firstName || !lastName || !phoneNumber) {
      showError("All fields are required");
      return false;
    }

    // Name validation
    if (firstName.trim().length < 2 || firstName.trim().length > 50) {
      showError("First name must be between 2 and 50 characters");
      return false;
    }

    if (lastName.trim().length < 2 || lastName.trim().length > 50) {
      showError("Last name must be between 2 and 50 characters");
      return false;
    }

    // Phone validation
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,15}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      showError("Please enter a valid phone number (10-15 digits)");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      await axios.put("/users/profile", {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
      });

      showSuccess("Profile updated successfully");

      // Update local profile state
      setProfile((prev) => ({
        ...prev,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
      }));

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      showError(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: profile.phoneNumber,
    });
    setIsEditing(false);
  };

  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "Not provided";

    // Basic formatting for display
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(
        3,
        6
      )}-${cleaned.substring(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(
        4,
        7
      )}-${cleaned.substring(7)}`;
    }
    return phoneNumber; // Return original if can't format
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Profile Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your personal information and account details
          </p>
        </div>

        {!isEditing && (
          <Button variant="primary" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {/* Profile Information Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Personal Information
          </h3>
        </div>

        <div className="px-6 py-6">
          {isEditing ? (
            /* Edit Form */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    placeholder="Enter your first name"
                    maxLength={50}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    placeholder="Enter your last name"
                    maxLength={50}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={editForm.phoneNumber}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      phoneNumber: e.target.value,
                    }))
                  }
                  placeholder="(555) 123-4567"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter 10-15 digits with or without formatting
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Your email address can only be changed
                  by an administrator. Contact your administrator if you need to
                  update your email.
                </p>
              </div>

              <div className="flex space-x-3 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={
                    saving ||
                    !editForm.firstName ||
                    !editForm.lastName ||
                    !editForm.phoneNumber
                  }
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            /* Display Mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                    {profile.firstName || "Not provided"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                    {profile.lastName || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                    {profile.email || "Not provided"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Contact administrator to change email
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                    {formatPhoneNumber(profile.phoneNumber)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Information Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Account Information
          </h3>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                  ${
                    profile.role === "admin"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {profile.role || "Not specified"}
                </span>
              </p>
            </div>

            {profile.bakerId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Baker ID
                </label>
                <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                  <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {profile.bakerId}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Status
              </label>
              <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${
                    profile.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {profile.isActive ? "Active" : "Inactive"}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Created
              </label>
              <p className="text-sm text-gray-900 py-2 px-3 bg-gray-50 rounded-md">
                {profile.createdAt
                  ? formatDate(profile.createdAt)
                  : "Not available"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Actions Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Account Actions</h3>
        </div>

        <div className="px-6 py-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  Change Password
                </h4>
                <p className="text-sm text-gray-600">
                  Update your account password for security
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/change-password")}
              >
                Change Password
              </Button>
            </div>

            {profile.role === "baker" && (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    My Orders
                  </h4>
                  <p className="text-sm text-gray-600">
                    View and manage your cookie cutter orders
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/orders")}
                >
                  View Orders
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          Profile Management Help
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">
              What You Can Update
            </h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>First & Last Name:</strong> Update your display name
              </li>
              <li>
                • <strong>Phone Number:</strong> Change your contact number
              </li>
              <li>
                • <strong>Password:</strong> Update for security
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">
              Administrator-Only Changes
            </h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>Email Address:</strong> Contact admin to update
              </li>
              <li>
                • <strong>Account Status:</strong> Admin can activate/deactivate
              </li>
              <li>
                • <strong>Role & Baker ID:</strong> System-managed
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-300">
          <h4 className="font-medium text-gray-800 mb-2">Data Requirements</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p>
                <strong>👤 Names:</strong> 2-50 characters each, required
              </p>
            </div>
            <div>
              <p>
                <strong>📞 Phone:</strong> 10-15 digits, must be unique
              </p>
            </div>
            <div>
              <p>
                <strong>🔒 Password:</strong> Minimum 6 characters
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileManagement;
