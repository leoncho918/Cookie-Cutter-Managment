// frontend/src/components/Admin/AdminSettings.js - Admin settings management component
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { formatDate, formatDateTime } from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import axios from "axios";

const AdminSettings = () => {
  const { user } = useAuth();
  const { showError, showSuccess, showWarning } = useToast();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [internationalModal, setInternationalModal] = useState({
    isOpen: false,
    enabled: false,
    notes: "",
  });

  const [resetModal, setResetModal] = useState({
    isOpen: false,
    confirmText: "",
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  // Only admins can access this component
  if (!user || user.role !== "admin") {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">
          Only administrators can access system settings.
        </p>
      </div>
    );
  }

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/settings");

      console.log("📋 Settings loaded:", response.data);
      setSettings(response.data.data);
    } catch (error) {
      console.error("❌ Error loading settings:", error);
      showError("Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const handleInternationalToggle = async () => {
    if (!settings) return;

    const newStatus = !settings.internationalAddresses.enabled;

    try {
      setSaving(true);

      const response = await axios.put("/settings/international", {
        enabled: newStatus,
        notes:
          internationalModal.notes || settings.internationalAddresses.notes,
      });

      console.log("🌍 International settings updated:", response.data);

      showSuccess(
        `International delivery ${
          newStatus ? "enabled" : "disabled"
        } successfully`
      );

      // Update local settings
      setSettings((prev) => ({
        ...prev,
        internationalAddresses: {
          ...prev.internationalAddresses,
          enabled: newStatus,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: user._id,
          notes: internationalModal.notes || prev.internationalAddresses.notes,
        },
      }));

      // Close modal
      setInternationalModal({
        isOpen: false,
        enabled: false,
        notes: "",
      });
    } catch (error) {
      console.error("❌ Error updating international settings:", error);
      showError(
        error.response?.data?.message ||
          "Failed to update international settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInternationalModal = () => {
    if (!settings) return;

    setInternationalModal({
      isOpen: true,
      enabled: !settings.internationalAddresses.enabled,
      notes: settings.internationalAddresses.notes || "",
    });
  };

  const handleResetSettings = async () => {
    if (resetModal.confirmText !== "RESET") {
      showError('Please type "RESET" to confirm');
      return;
    }

    try {
      setSaving(true);

      const response = await axios.post("/settings/reset", {
        confirmReset: true,
      });

      console.log("🔄 Settings reset:", response.data);

      showWarning("System settings have been reset to defaults");

      // Reload settings
      await loadSettings();

      setResetModal({
        isOpen: false,
        confirmText: "",
      });
    } catch (error) {
      console.error("❌ Error resetting settings:", error);
      showError(error.response?.data?.message || "Failed to reset settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings Not Found</h1>
        <p className="text-gray-600 mt-2">Unable to load system settings.</p>
        <Button variant="primary" onClick={loadSettings} className="mt-4">
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage system-wide configuration and features
          </p>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" onClick={loadSettings} disabled={loading}>
            Refresh Settings
          </Button>
          <Button
            variant="danger"
            onClick={() => setResetModal({ isOpen: true, confirmText: "" })}
            disabled={saving}
          >
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* International Address Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🌍</span>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  International Delivery
                </h3>
                <p className="text-sm text-gray-600">
                  Enable or disable international delivery addresses
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    settings.internationalAddresses.enabled
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {settings.internationalAddresses.enabled
                    ? "Enabled"
                    : "Disabled"}
                </span>
              </div>

              <Button
                variant={
                  settings.internationalAddresses.enabled ? "danger" : "primary"
                }
                onClick={handleOpenInternationalModal}
                disabled={saving}
                loading={saving}
              >
                {settings.internationalAddresses.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Current Status
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">International Delivery:</span>
                  <span
                    className={`font-medium ${
                      settings.internationalAddresses.enabled
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {settings.internationalAddresses.enabled
                      ? "Enabled"
                      : "Disabled"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Supported Countries:</span>
                  <span className="font-medium text-gray-900">
                    {settings.internationalAddresses.supportedCountries
                      ?.length || 0}
                  </span>
                </div>

                {settings.internationalAddresses.lastModifiedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Modified:</span>
                    <span className="font-medium text-gray-900">
                      {formatDateTime(
                        settings.internationalAddresses.lastModifiedAt
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Impact & Information
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start">
                  <span className="text-green-600 mr-2 mt-0.5">✅</span>
                  <span>
                    When <strong>enabled</strong>: Users can select any country
                    for delivery addresses
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="text-blue-600 mr-2 mt-0.5">🇦🇺</span>
                  <span>
                    When <strong>disabled</strong>: Only Australia is available
                    for delivery addresses
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="text-yellow-600 mr-2 mt-0.5">⚠️</span>
                  <span>
                    Changes apply immediately to all new orders and completion
                    forms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {settings.internationalAddresses.notes && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-md p-3">
                {settings.internationalAddresses.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Order Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📋</span>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Order Settings
              </h3>
              <p className="text-sm text-gray-600">
                System-wide order configuration
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Order Limits
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Items Per Order:</span>
                  <span className="font-medium text-gray-900">
                    {settings.orderSettings?.maxItemsPerOrder || 20}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Default Expiration:</span>
                  <span className="font-medium text-gray-900">
                    {settings.orderSettings?.defaultOrderExpiration || 30} days
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                System Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Settings Created:</span>
                  <span className="font-medium text-gray-900">
                    {settings.createdAt
                      ? formatDateTime(settings.createdAt)
                      : "Unknown"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="font-medium text-gray-900">
                    {formatDateTime(settings.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* International Address Modal */}
      <Modal
        isOpen={internationalModal.isOpen}
        onClose={() =>
          setInternationalModal({ isOpen: false, enabled: false, notes: "" })
        }
        title={`${
          internationalModal.enabled ? "Enable" : "Disable"
        } International Delivery`}
        size="medium"
      >
        <div className="space-y-4">
          <div
            className={`p-4 rounded-md border ${
              internationalModal.enabled
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center">
              <span
                className={`text-2xl mr-3 ${
                  internationalModal.enabled ? "text-green-600" : "text-red-600"
                }`}
              >
                {internationalModal.enabled ? "🌍✅" : "🌍❌"}
              </span>
              <div>
                <h4
                  className={`text-sm font-medium ${
                    internationalModal.enabled
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {internationalModal.enabled
                    ? "Enable International Delivery"
                    : "Disable International Delivery"}
                </h4>
                <p
                  className={`text-sm mt-1 ${
                    internationalModal.enabled
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {internationalModal.enabled
                    ? "Users will be able to select any country for delivery addresses"
                    : "Only Australia will be available for delivery addresses"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={internationalModal.notes}
              onChange={(e) =>
                setInternationalModal((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              placeholder="Add any notes about this change..."
              rows={3}
              maxLength={1000}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              {internationalModal.notes.length}/1000 characters
            </div>
          </div>

          <div
            className={`p-3 rounded-md ${
              internationalModal.enabled ? "bg-blue-50" : "bg-yellow-50"
            }`}
          >
            <h5
              className={`text-sm font-medium mb-2 ${
                internationalModal.enabled ? "text-blue-800" : "text-yellow-800"
              }`}
            >
              What happens when you{" "}
              {internationalModal.enabled ? "enable" : "disable"} this:
            </h5>
            <ul
              className={`text-sm space-y-1 ${
                internationalModal.enabled ? "text-blue-700" : "text-yellow-700"
              }`}
            >
              {internationalModal.enabled ? (
                <>
                  <li>
                    • Country dropdown will show all{" "}
                    {settings.internationalAddresses.supportedCountries
                      ?.length || 0}{" "}
                    supported countries
                  </li>
                  <li>
                    • Address validation will adapt to each country's format
                  </li>
                  <li>• Orders will show international delivery indicators</li>
                  <li>
                    • Payment notifications will mention international shipping
                    fees
                  </li>
                </>
              ) : (
                <>
                  <li>• Country dropdown will only show Australia</li>
                  <li>• Existing international orders remain unchanged</li>
                  <li>• New completion forms default to Australia only</li>
                  <li>• International delivery indicators will be hidden</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setInternationalModal({
                  isOpen: false,
                  enabled: false,
                  notes: "",
                })
              }
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant={internationalModal.enabled ? "primary" : "danger"}
              onClick={handleInternationalToggle}
              loading={saving}
              disabled={saving}
            >
              {internationalModal.enabled
                ? "Enable International Delivery"
                : "Disable International Delivery"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Settings Modal */}
      <Modal
        isOpen={resetModal.isOpen}
        onClose={() => setResetModal({ isOpen: false, confirmText: "" })}
        title="Reset System Settings"
        size="medium"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-md border bg-red-50 border-red-200">
            <div className="flex items-center">
              <span className="text-red-600 text-2xl mr-3">⚠️</span>
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  Danger: Reset All Settings
                </h4>
                <p className="text-sm mt-1 text-red-700">
                  This will reset all system settings to their default values.
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-4">
              To confirm this action, please type <strong>RESET</strong> in the
              field below:
            </p>
            <input
              type="text"
              value={resetModal.confirmText}
              onChange={(e) =>
                setResetModal((prev) => ({
                  ...prev,
                  confirmText: e.target.value,
                }))
              }
              placeholder="Type RESET to confirm"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="bg-yellow-50 p-3 rounded-md">
            <h5 className="text-sm font-medium text-yellow-800 mb-2">
              What will be reset:
            </h5>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• International delivery will be disabled</li>
              <li>• All notes and modification history will be cleared</li>
              <li>• Order settings will return to defaults</li>
              <li>• Supported countries list will be restored</li>
            </ul>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setResetModal({ isOpen: false, confirmText: "" })}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleResetSettings}
              loading={saving}
              disabled={saving || resetModal.confirmText !== "RESET"}
            >
              Reset All Settings
            </Button>
          </div>
        </div>
      </Modal>

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          System Settings Help
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">
              International Delivery
            </h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>When Enabled:</strong> All supported countries appear
                in address forms
              </li>
              <li>
                • <strong>When Disabled:</strong> Only Australia is available
                for delivery
              </li>
              <li>
                • <strong>Existing Orders:</strong> Not affected by changes
              </li>
              <li>
                • <strong>Real-time:</strong> Changes apply immediately to new
                forms
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Best Practices</h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>Disable Gradually:</strong> Announce changes to users
                first
              </li>
              <li>
                • <strong>Add Notes:</strong> Document why settings were changed
              </li>
              <li>
                • <strong>Monitor Orders:</strong> Check for user confusion
                after changes
              </li>
              <li>
                • <strong>Backup Data:</strong> Changes can't be undone easily
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-300">
          <h4 className="font-medium text-gray-800 mb-2">Quick Actions</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <p>
                <strong>🌍 International Toggle:</strong> Enable/disable
                international delivery instantly
              </p>
            </div>
            <div>
              <p>
                <strong>🔄 Refresh Settings:</strong> Reload current
                configuration from database
              </p>
            </div>
            <div>
              <p>
                <strong>⚠️ Reset Defaults:</strong> Restore all settings to
                original defaults (dangerous)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
