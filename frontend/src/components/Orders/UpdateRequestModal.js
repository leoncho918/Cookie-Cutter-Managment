import React from "react";
import Modal from "../UI/Modal";
import Button from "../UI/Button";
import { DELIVERY_METHODS, PAYMENT_METHODS } from "../../utils/orderHelpers";

const UpdateRequestModal = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  updateRequestData,
  setUpdateRequestData,
  order,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!updateRequestData.reason.trim()) {
      alert("Please provide a reason for the update request");
      return;
    }
    onSubmit();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Collection & Payment Update"
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Details Display */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-900 mb-3">
            Current Details
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Collection Method:</span>
              <span>{order.deliveryMethod || "Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Payment Method:</span>
              <span>{order.paymentMethod || "Not set"}</span>
            </div>
          </div>
        </div>

        {/* Requested Changes */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-gray-900">
            Requested Changes
          </h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collection Method
            </label>
            <select
              value={updateRequestData.requestedChanges.deliveryMethod}
              onChange={(e) =>
                setUpdateRequestData((prev) => ({
                  ...prev,
                  requestedChanges: {
                    ...prev.requestedChanges,
                    deliveryMethod: e.target.value,
                  },
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select collection method</option>
              {Object.values(DELIVERY_METHODS).map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={updateRequestData.requestedChanges.paymentMethod}
              onChange={(e) =>
                setUpdateRequestData((prev) => ({
                  ...prev,
                  requestedChanges: {
                    ...prev.requestedChanges,
                    paymentMethod: e.target.value,
                  },
                }))
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select payment method</option>
              {Object.values(PAYMENT_METHODS).map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Update *
            </label>
            <textarea
              value={updateRequestData.reason}
              onChange={(e) =>
                setUpdateRequestData((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              placeholder="Please explain why you need to update these details..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[100px]"
              required
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Send Request to Admin
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default UpdateRequestModal;
