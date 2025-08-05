// src/components/Admin/UserManagement.js - Enhanced Admin user management with name and phone fields
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { formatDate } from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import axios from "axios";

const UserManagement = () => {
  const { user, resetPassword } = useAuth();
  const { showError, showSuccess } = useToast();

  const [bakers, setBakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [createModal, setCreateModal] = useState({
    isOpen: false,
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
  });

  const [editModal, setEditModal] = useState({
    isOpen: false,
    bakerId: null,
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
  });

  const [resetModal, setResetModal] = useState({
    isOpen: false,
    bakerId: null,
    bakerEmail: "",
    bakerName: "",
  });

  // React hooks must be called before any conditional returns
  useEffect(() => {
    // Only load bakers if user is admin
    if (user && user.role === "admin") {
      loadBakers();
    }
  }, [user]);

  // Search functionality
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  // Only admins can access this component
  if (!user || user.role !== "admin") {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">
          Only administrators can access user management.
        </p>
      </div>
    );
  }

  const loadBakers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/users/bakers");
      setBakers(response.data);
    } catch (error) {
      console.error("Error loading bakers:", error);
      showError("Failed to load bakers");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;

    try {
      setIsSearching(true);
      const response = await axios.get(
        `/users/bakers/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      setSearchResults(response.data.results);
    } catch (error) {
      console.error("Error searching bakers:", error);
      showError("Failed to search bakers");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const validateForm = (formData) => {
    const { email, firstName, lastName, phoneNumber } = formData;

    if (!email || !firstName || !lastName || !phoneNumber) {
      showError("All fields are required");
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError("Please enter a valid email address");
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

  const handleCreateBaker = async () => {
    if (!validateForm(createModal)) return;

    try {
      setActionLoading(true);
      const response = await axios.post("/users/bakers", {
        email: createModal.email.trim(),
        firstName: createModal.firstName.trim(),
        lastName: createModal.lastName.trim(),
        phoneNumber: createModal.phoneNumber.trim(),
      });

      showSuccess(
        `Baker account created successfully! Baker ID: ${response.data.baker.bakerId}`
      );

      if (!response.data.emailSent) {
        showError(
          "Account created but email notification failed to send. Please inform the baker manually."
        );
      }

      loadBakers();
      setCreateModal({
        isOpen: false,
        email: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
      });
    } catch (error) {
      console.error("Error creating baker:", error);
      showError(
        error.response?.data?.message || "Failed to create baker account"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateBaker = async () => {
    if (!validateForm(editModal)) return;

    try {
      setActionLoading(true);
      await axios.put(`/users/bakers/${editModal.bakerId}`, {
        email: editModal.email.trim(),
        firstName: editModal.firstName.trim(),
        lastName: editModal.lastName.trim(),
        phoneNumber: editModal.phoneNumber.trim(),
      });

      showSuccess("Baker information updated successfully");
      loadBakers();
      setEditModal({
        isOpen: false,
        bakerId: null,
        email: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
      });
    } catch (error) {
      console.error("Error updating baker:", error);
      showError(
        error.response?.data?.message || "Failed to update baker information"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setActionLoading(true);
      const result = await resetPassword(resetModal.bakerId);

      if (result.success) {
        showSuccess(
          "Password reset successfully. Temporary password sent via email."
        );
      } else {
        showError(result.message);
      }

      loadBakers();
      setResetModal({
        isOpen: false,
        bakerId: null,
        bakerEmail: "",
        bakerName: "",
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      showError("Failed to reset password");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (bakerId, currentStatus) => {
    try {
      setActionLoading(true);
      await axios.put(`/users/bakers/${bakerId}/toggle-status`);

      showSuccess(
        `Baker ${currentStatus ? "deactivated" : "activated"} successfully`
      );
      loadBakers();
    } catch (error) {
      console.error("Error toggling status:", error);
      showError("Failed to update baker status");
    } finally {
      setActionLoading(false);
    }
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

  const displayBakers = searchQuery.trim().length >= 2 ? searchResults : bakers;

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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage baker accounts and permissions
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() =>
            setCreateModal({
              isOpen: true,
              email: "",
              firstName: "",
              lastName: "",
              phoneNumber: "",
            })
          }
        >
          Create Baker Account
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Bakers
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, or Baker ID..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isSearching && <LoadingSpinner size="small" />}
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="mt-2 text-sm text-gray-600">
            {isSearching
              ? "Searching..."
              : `Found ${searchResults.length} result${
                  searchResults.length !== 1 ? "s" : ""
                } for "${searchQuery}"`}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Bakers</p>
              <p className="text-2xl font-bold text-gray-900">
                {bakers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Bakers</p>
              <p className="text-2xl font-bold text-gray-900">
                {bakers.filter((baker) => baker.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <span className="text-2xl">🔑</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                First Login Pending
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {bakers.filter((baker) => baker.isFirstLogin).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-2xl">⏸️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">
                {bakers.filter((baker) => !baker.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bakers Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Baker Accounts
            {searchQuery.trim().length >= 2 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (Search Results)
              </span>
            )}
          </h3>
        </div>

        {displayBakers.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">
              {searchQuery.trim().length >= 2 ? "🔍" : "👥"}
            </span>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery.trim().length >= 2
                ? "No results found"
                : "No bakers yet"}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery.trim().length >= 2
                ? `No bakers match "${searchQuery}". Try a different search term.`
                : "Create your first baker account to get started."}
            </p>
            {searchQuery.trim().length < 2 && (
              <Button
                variant="primary"
                onClick={() =>
                  setCreateModal({
                    isOpen: true,
                    email: "",
                    firstName: "",
                    lastName: "",
                    phoneNumber: "",
                  })
                }
              >
                Create First Baker
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Baker Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Information
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Login Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayBakers.map((baker) => (
                  <tr key={baker._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {baker.firstName} {baker.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {baker.bakerId}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {baker.email}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatPhoneNumber(baker.phoneNumber)}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${
                            baker.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        `}
                      >
                        {baker.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${
                            baker.isFirstLogin
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }
                        `}
                      >
                        {baker.isFirstLogin
                          ? "First Login Pending"
                          : "Password Set"}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(baker.createdAt)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2 justify-end">
                        <button
                          onClick={() =>
                            setEditModal({
                              isOpen: true,
                              bakerId: baker._id,
                              email: baker.email,
                              firstName: baker.firstName,
                              lastName: baker.lastName,
                              phoneNumber: baker.phoneNumber,
                            })
                          }
                          className="text-blue-600 hover:text-blue-900"
                          disabled={actionLoading}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            setResetModal({
                              isOpen: true,
                              bakerId: baker._id,
                              bakerEmail: baker.email,
                              bakerName: `${baker.firstName} ${baker.lastName}`,
                            })
                          }
                          className="text-purple-600 hover:text-purple-900"
                          disabled={actionLoading}
                        >
                          Reset Password
                        </button>

                        <button
                          onClick={() =>
                            handleToggleStatus(baker._id, baker.isActive)
                          }
                          className={
                            baker.isActive
                              ? "text-red-600 hover:text-red-900"
                              : "text-green-600 hover:text-green-900"
                          }
                          disabled={actionLoading}
                        >
                          {baker.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Baker Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={() =>
          setCreateModal({
            isOpen: false,
            email: "",
            firstName: "",
            lastName: "",
            phoneNumber: "",
          })
        }
        title="Create Baker Account"
        size="medium"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={createModal.firstName}
                onChange={(e) =>
                  setCreateModal((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                placeholder="John"
                maxLength={50}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={actionLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={createModal.lastName}
                onChange={(e) =>
                  setCreateModal((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                placeholder="Doe"
                maxLength={50}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={actionLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={createModal.email}
              onChange={(e) =>
                setCreateModal((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="baker@example.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={actionLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={createModal.phoneNumber}
              onChange={(e) =>
                setCreateModal((prev) => ({
                  ...prev,
                  phoneNumber: e.target.value,
                }))
              }
              placeholder="(555) 123-4567"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={actionLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter 10-15 digits with or without formatting
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              What happens next:
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• A unique Baker ID will be generated automatically</li>
              <li>• A temporary password will be created</li>
              <li>• An email will be sent with login credentials</li>
              <li>• The baker must change their password on first login</li>
            </ul>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setCreateModal({
                  isOpen: false,
                  email: "",
                  firstName: "",
                  lastName: "",
                  phoneNumber: "",
                })
              }
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateBaker}
              loading={actionLoading}
              disabled={
                actionLoading ||
                !createModal.email ||
                !createModal.firstName ||
                !createModal.lastName ||
                !createModal.phoneNumber
              }
            >
              Create Baker Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Baker Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() =>
          setEditModal({
            isOpen: false,
            bakerId: null,
            email: "",
            firstName: "",
            lastName: "",
            phoneNumber: "",
          })
        }
        title="Update Baker Information"
        size="medium"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={editModal.firstName}
                onChange={(e) =>
                  setEditModal((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                placeholder="John"
                maxLength={50}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={actionLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={editModal.lastName}
                onChange={(e) =>
                  setEditModal((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                placeholder="Doe"
                maxLength={50}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={actionLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={editModal.email}
              onChange={(e) =>
                setEditModal((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="baker@example.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={actionLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={editModal.phoneNumber}
              onChange={(e) =>
                setEditModal((prev) => ({
                  ...prev,
                  phoneNumber: e.target.value,
                }))
              }
              placeholder="(555) 123-4567"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={actionLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter 10-15 digits with or without formatting
            </p>
          </div>

          <div className="bg-yellow-50 p-4 rounded-md">
            <p className="text-sm text-yellow-700">
              <strong>Note:</strong> Changing the baker's information will not
              automatically notify them. Please inform them of any changes
              manually if necessary.
            </p>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setEditModal({
                  isOpen: false,
                  bakerId: null,
                  email: "",
                  firstName: "",
                  lastName: "",
                  phoneNumber: "",
                })
              }
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateBaker}
              loading={actionLoading}
              disabled={
                actionLoading ||
                !editModal.email ||
                !editModal.firstName ||
                !editModal.lastName ||
                !editModal.phoneNumber
              }
            >
              Update Information
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModal.isOpen}
        onClose={() =>
          setResetModal({
            isOpen: false,
            bakerId: null,
            bakerEmail: "",
            bakerName: "",
          })
        }
        title="Reset Password"
        size="medium"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              Are you sure you want to reset the password for{" "}
              <strong>{resetModal.bakerName}</strong> ({resetModal.bakerEmail})?
            </p>
          </div>

          <div className="bg-orange-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-orange-800 mb-2">
              What will happen:
            </h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• A new temporary password will be generated</li>
              <li>
                • An email will be sent to the baker with the new password
              </li>
              <li>
                • The baker will be required to change the password on next
                login
              </li>
              <li>• Their current session (if any) will be invalidated</li>
            </ul>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setResetModal({
                  isOpen: false,
                  bakerId: null,
                  bakerEmail: "",
                  bakerName: "",
                })
              }
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleResetPassword}
              loading={actionLoading}
              disabled={actionLoading}
            >
              Reset Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          User Management Guide
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">
              Baker Account Lifecycle
            </h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>Creation:</strong> Admin creates account with personal
                details
              </li>
              <li>
                • <strong>Notification:</strong> Baker receives email with
                credentials
              </li>
              <li>
                • <strong>First Login:</strong> Baker must change password
              </li>
              <li>
                • <strong>Active:</strong> Baker can create and manage orders
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">
              Management Actions
            </h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>Edit Information:</strong> Update name, email, phone
              </li>
              <li>
                • <strong>Reset Password:</strong> Generate new temporary
                password
              </li>
              <li>
                • <strong>Deactivate:</strong> Prevent login without deleting
                account
              </li>
              <li>
                • <strong>Search:</strong> Find bakers by any field
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-300">
          <h4 className="font-medium text-gray-800 mb-2">Data Requirements</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p>
                <strong>📧 Email:</strong> Must be unique and valid format
              </p>
            </div>
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
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-300">
          <h4 className="font-medium text-gray-800 mb-2">Quick Tips</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p>
                <strong>🔍 Search:</strong> Use the search bar to quickly find
                bakers by any field
              </p>
            </div>
            <div>
              <p>
                <strong>📊 Statistics:</strong> Monitor account status at a
                glance with the dashboard cards
              </p>
            </div>
            <div>
              <p>
                <strong>✉️ Emails:</strong> All account actions automatically
                send notification emails
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
