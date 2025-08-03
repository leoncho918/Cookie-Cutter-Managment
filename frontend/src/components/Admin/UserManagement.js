// src/components/Admin/UserManagement.js - Complete Admin user management component
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
  const [createModal, setCreateModal] = useState({ isOpen: false, email: "" });
  const [editModal, setEditModal] = useState({
    isOpen: false,
    bakerId: null,
    email: "",
  });
  const [resetModal, setResetModal] = useState({
    isOpen: false,
    bakerId: null,
    bakerEmail: "",
  });

  // React hooks must be called before any conditional returns
  useEffect(() => {
    // Only load bakers if user is admin
    if (user && user.role === "admin") {
      loadBakers();
    }
  }, [user]);

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

  const handleCreateBaker = async () => {
    if (!createModal.email) {
      showError("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createModal.email)) {
      showError("Please enter a valid email address");
      return;
    }

    try {
      setActionLoading(true);
      const response = await axios.post("/users/bakers", {
        email: createModal.email,
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
      setCreateModal({ isOpen: false, email: "" });
    } catch (error) {
      console.error("Error creating baker:", error);
      showError(
        error.response?.data?.message || "Failed to create baker account"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!editModal.email) {
      showError("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editModal.email)) {
      showError("Please enter a valid email address");
      return;
    }

    try {
      setActionLoading(true);
      await axios.put(`/users/bakers/${editModal.bakerId}/email`, {
        email: editModal.email,
      });

      showSuccess("Baker email updated successfully");
      loadBakers();
      setEditModal({ isOpen: false, bakerId: null, email: "" });
    } catch (error) {
      console.error("Error updating email:", error);
      showError(error.response?.data?.message || "Failed to update email");
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
      setResetModal({ isOpen: false, bakerId: null, bakerEmail: "" });
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
          onClick={() => setCreateModal({ isOpen: true, email: "" })}
        >
          Create Baker Account
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      </div>

      {/* Bakers Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Baker Accounts</h3>
        </div>

        {bakers.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">👥</span>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No bakers yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first baker account to get started.
            </p>
            <Button
              variant="primary"
              onClick={() => setCreateModal({ isOpen: true, email: "" })}
            >
              Create First Baker
            </Button>
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
                {bakers.map((baker) => (
                  <tr key={baker._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {baker.bakerId}
                        </div>
                        <div className="text-sm text-gray-500">
                          {baker.email}
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
                            })
                          }
                          className="text-blue-600 hover:text-blue-900"
                          disabled={actionLoading}
                        >
                          Edit Email
                        </button>

                        <button
                          onClick={() =>
                            setResetModal({
                              isOpen: true,
                              bakerId: baker._id,
                              bakerEmail: baker.email,
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
        onClose={() => setCreateModal({ isOpen: false, email: "" })}
        title="Create Baker Account"
        size="medium"
      >
        <div className="space-y-4">
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
              onClick={() => setCreateModal({ isOpen: false, email: "" })}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateBaker}
              loading={actionLoading}
              disabled={actionLoading || !createModal.email}
            >
              Create Baker Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Email Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() =>
          setEditModal({ isOpen: false, bakerId: null, email: "" })
        }
        title="Update Baker Email"
        size="medium"
      >
        <div className="space-y-4">
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

          <div className="bg-yellow-50 p-4 rounded-md">
            <p className="text-sm text-yellow-700">
              <strong>Note:</strong> Changing the email address will not
              automatically notify the baker. Please inform them of the change
              manually.
            </p>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setEditModal({ isOpen: false, bakerId: null, email: "" })
              }
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateEmail}
              loading={actionLoading}
              disabled={actionLoading || !editModal.email}
            >
              Update Email
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetModal.isOpen}
        onClose={() =>
          setResetModal({ isOpen: false, bakerId: null, bakerEmail: "" })
        }
        title="Reset Password"
        size="medium"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              Are you sure you want to reset the password for{" "}
              <strong>{resetModal.bakerEmail}</strong>?
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
                setResetModal({ isOpen: false, bakerId: null, bakerEmail: "" })
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
                • <strong>Creation:</strong> Admin creates account with email
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
                • <strong>Edit Email:</strong> Update baker's contact
                information
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
                • <strong>Activate:</strong> Re-enable deactivated accounts
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-300">
          <h4 className="font-medium text-gray-800 mb-2">Quick Tips</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p>
                <strong>📧 Email Setup:</strong> Ensure your email service is
                properly configured for notifications to work.
              </p>
            </div>
            <div>
              <p>
                <strong>🔐 Security:</strong> Bakers are forced to change
                passwords on first login for security.
              </p>
            </div>
            <div>
              <p>
                <strong>📊 Monitoring:</strong> Use the statistics cards to
                track baker account status at a glance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
