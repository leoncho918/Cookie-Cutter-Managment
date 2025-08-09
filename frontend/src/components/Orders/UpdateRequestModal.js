import React from "react";
import Modal from "../UI/Modal";
import Button from "../UI/Button";

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
            Reason for Update
          </h4>
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
