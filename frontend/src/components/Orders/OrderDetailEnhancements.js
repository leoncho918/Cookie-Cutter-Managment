// Enhanced OrderDetail.js component that integrates pickup details
// This shows the key changes to integrate with the new pickup functionality

import React, { useState } from "react";
import CompletionModal from "./CompletionModal";
import PickupDetails from "./PickupDetails";
import Modal from "../UI/Modal";
import Button from "../UI/Button";

// Add this to the existing OrderDetail component

const OrderDetailEnhancements = ({ order, user }) => {
  const [showPickupDetails, setShowPickupDetails] = useState(false);
  const [completionModal, setCompletionModal] = useState({
    isOpen: false,
    deliveryMethod: "",
    paymentMethod: "",
    pickupDate: "",
    pickupTime: "",
    pickupNotes: "",
  });

  // Enhanced completion details display
  const renderCompletionDetails = () => {
    if (order.stage !== "Completed") return null;

    return (
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Completion Details
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {order.deliveryMethod === "Pickup" ? "🚶" : "🚚"}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-700">
                Delivery Method:
              </div>
              <div className="text-sm text-gray-900">
                {order.deliveryMethod || "Not specified"}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {order.paymentMethod === "Cash" ? "💵" : "💳"}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-700">
                Payment Method:
              </div>
              <div className="text-sm text-gray-900">
                {order.paymentMethod || "Not specified"}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Pickup Schedule Details */}
        {order.deliveryMethod === "Pickup" && (
          <div className="mt-6">
            {order.pickupSchedule &&
            order.pickupSchedule.date &&
            order.pickupSchedule.time ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-sm font-medium text-blue-800 mb-2">
                      📅 Scheduled Pickup
                    </h5>
                    <div className="text-blue-700 space-y-1">
                      <div className="font-semibold">
                        {new Date(order.pickupSchedule.date).toLocaleDateString(
                          "en-AU",
                          {
                            weekday: "long",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }
                        )}{" "}
                        at {order.pickupSchedule.time}
                      </div>
                      <div className="text-sm">
                        📍 40A Brancourt Ave, Bankstown NSW 2200
                      </div>
                      {order.pickupSchedule.notes && (
                        <div className="text-sm mt-2">
                          <strong>Notes:</strong> {order.pickupSchedule.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => setShowPickupDetails(true)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    📍 View Location & Map
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-yellow-600 text-xl mr-3">⚠️</span>
                  <div>
                    <h5 className="text-sm font-medium text-yellow-800">
                      Pickup Schedule Needed
                    </h5>
                    <p className="text-yellow-700 text-sm">
                      Please set your pickup date and time to complete the order
                      process.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action button for bakers to update details */}
        {user.role === "baker" && order.bakerId === user.bakerId && (
          <div className="mt-4">
            <Button
              variant="primary"
              size="small"
              onClick={() =>
                setCompletionModal({
                  isOpen: true,
                  deliveryMethod: order.deliveryMethod || "",
                  paymentMethod: order.paymentMethod || "",
                  pickupDate: order.pickupSchedule?.date
                    ? new Date(order.pickupSchedule.date)
                        .toISOString()
                        .split("T")[0]
                    : "",
                  pickupTime: order.pickupSchedule?.time || "",
                  pickupNotes: order.pickupSchedule?.notes || "",
                })
              }
            >
              {order.deliveryMethod && order.paymentMethod
                ? "Update Completion Details"
                : "Set Completion Details"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Enhanced completion modal handler
  const handleCompletionUpdate = async () => {
    const {
      deliveryMethod,
      paymentMethod,
      pickupDate,
      pickupTime,
      pickupNotes,
    } = completionModal;

    // Validation
    if (!deliveryMethod || !paymentMethod) {
      showError("Please select both delivery and payment methods");
      return;
    }

    // If pickup is selected, validate pickup details
    if (deliveryMethod === "Pickup") {
      if (!pickupDate) {
        showError("Please select a pickup date");
        return;
      }
      if (!pickupTime) {
        showError("Please select a pickup time");
        return;
      }

      // Validate pickup date is not in the past
      const selectedDateTime = new Date(`${pickupDate}T${pickupTime}`);
      const now = new Date();
      if (selectedDateTime < now) {
        showError("Pickup date and time cannot be in the past");
        return;
      }
    }

    try {
      setActionLoading(true);

      const payload = {
        deliveryMethod,
        paymentMethod,
      };

      // Add pickup schedule if pickup is selected
      if (deliveryMethod === "Pickup") {
        payload.pickupSchedule = {
          date: pickupDate,
          time: pickupTime,
          notes: pickupNotes || "",
        };
      }

      await axios.put(`/orders/${order._id}/completion`, payload);

      showSuccess("Completion details updated successfully");
      loadOrder(); // Refresh the order data
      setCompletionModal({
        isOpen: false,
        deliveryMethod: "",
        paymentMethod: "",
        pickupDate: "",
        pickupTime: "",
        pickupNotes: "",
      });
    } catch (error) {
      console.error("Error updating completion details:", error);
      showError(
        error.response?.data?.message || "Failed to update completion details"
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Render the enhanced completion details */}
      {renderCompletionDetails()}

      {/* Enhanced Completion Modal */}
      <CompletionModal
        isOpen={completionModal.isOpen}
        onClose={() =>
          setCompletionModal({
            isOpen: false,
            deliveryMethod: "",
            paymentMethod: "",
            pickupDate: "",
            pickupTime: "",
            pickupNotes: "",
          })
        }
        onSubmit={handleCompletionUpdate}
        loading={actionLoading}
        completionData={completionModal}
        setCompletionData={setCompletionModal}
        order={order}
      />

      {/* Pickup Details Modal */}
      <Modal
        isOpen={showPickupDetails}
        onClose={() => setShowPickupDetails(false)}
        title="Pickup Information"
        size="xlarge"
      >
        <PickupDetails
          order={order}
          onClose={() => setShowPickupDetails(false)}
        />
      </Modal>
    </>
  );
};

export default OrderDetailEnhancements;
