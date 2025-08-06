// Enhanced completion modal component that shows pickup details
// This replaces the completion modal in OrderDetail.js

import React, { useState } from "react";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import PickupDetails from "./PickupDetails";

const CompletionModal = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  completionData,
  setCompletionData,
  order,
}) => {
  const [showPickupDetails, setShowPickupDetails] = useState(false);

  const handleDeliveryMethodChange = (method) => {
    setCompletionData((prev) => ({
      ...prev,
      deliveryMethod: method,
      // Clear pickup-specific fields if switching to delivery
      ...(method === "Delivery" && {
        pickupDate: "",
        pickupTime: "",
        pickupNotes: "",
      }),
    }));
  };

  const validateForm = () => {
    if (!completionData.deliveryMethod || !completionData.paymentMethod) {
      return false;
    }

    if (completionData.deliveryMethod === "Pickup") {
      return completionData.pickupDate && completionData.pickupTime;
    }

    return true;
  };

  // If showing pickup details, render that component
  if (showPickupDetails) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setShowPickupDetails(false)}
        title="Pickup Information"
        size="xlarge"
      >
        <PickupDetails
          order={order}
          onClose={() => setShowPickupDetails(false)}
        />
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Order Completion Details"
      size="large"
    >
      <div className="space-y-6">
        {/* Success Message */}
        <div className="text-center bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-3">
            <span className="text-2xl">🎉</span>
          </div>
          <h3 className="text-lg font-medium text-green-800">
            Order Completed Successfully!
          </h3>
          <p className="text-green-600 mt-1">
            Your order {order.orderNumber} is ready for collection or delivery
          </p>
        </div>

        {/* Delivery Method Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How would you like to receive your order? *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pickup Option */}
            <label
              className={`
                relative flex flex-col p-6 border-2 rounded-lg cursor-pointer transition-all duration-200
                ${
                  completionData.deliveryMethod === "Pickup"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <input
                type="radio"
                name="deliveryMethod"
                value="Pickup"
                checked={completionData.deliveryMethod === "Pickup"}
                onChange={(e) => handleDeliveryMethodChange(e.target.value)}
                className="sr-only"
              />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">🚶</span>
                  <div>
                    <div className="font-semibold text-gray-900">Pickup</div>
                    <div className="text-sm text-gray-600">
                      I'll collect my order
                    </div>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    completionData.deliveryMethod === "Pickup"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300"
                  }`}
                >
                  {completionData.deliveryMethod === "Pickup" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </div>

              {completionData.deliveryMethod === "Pickup" && (
                <div className="mt-2 pt-3 border-t border-blue-200">
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>
                      <strong>Address:</strong> 40A Brancourt Ave, Bankstown NSW
                      2200
                    </div>
                    <div>
                      <strong>Hours:</strong> Mon-Fri 9AM-5PM, Sat 10AM-2PM
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPickupDetails(true);
                    }}
                    className="mt-3 text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    📍 View Full Pickup Details & Map
                  </Button>
                </div>
              )}
            </label>

            {/* Delivery Option */}
            <label
              className={`
                relative flex flex-col p-6 border-2 rounded-lg cursor-pointer transition-all duration-200
                ${
                  completionData.deliveryMethod === "Delivery"
                    ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                    : "border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <input
                type="radio"
                name="deliveryMethod"
                value="Delivery"
                checked={completionData.deliveryMethod === "Delivery"}
                onChange={(e) => handleDeliveryMethodChange(e.target.value)}
                className="sr-only"
              />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">🚚</span>
                  <div>
                    <div className="font-semibold text-gray-900">Delivery</div>
                    <div className="text-sm text-gray-600">
                      Deliver to my address
                    </div>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    completionData.deliveryMethod === "Delivery"
                      ? "border-green-500 bg-green-500"
                      : "border-gray-300"
                  }`}
                >
                  {completionData.deliveryMethod === "Delivery" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </div>

              {completionData.deliveryMethod === "Delivery" && (
                <div className="mt-2 pt-3 border-t border-green-200">
                  <div className="text-sm text-green-700">
                    <div>
                      <strong>Note:</strong> Delivery arrangements will be
                      coordinated separately
                    </div>
                    <div>You will be contacted to arrange delivery details</div>
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Pickup Scheduling - Only show if Pickup is selected */}
        {completionData.deliveryMethod === "Pickup" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-blue-800 mb-4">
              📅 Schedule Your Pickup
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Pickup Date *
                </label>
                <input
                  type="date"
                  value={completionData.pickupDate}
                  onChange={(e) =>
                    setCompletionData((prev) => ({
                      ...prev,
                      pickupDate: e.target.value,
                    }))
                  }
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="w-full border border-blue-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Pickup Time *
                </label>
                <select
                  value={completionData.pickupTime}
                  onChange={(e) =>
                    setCompletionData((prev) => ({
                      ...prev,
                      pickupTime: e.target.value,
                    }))
                  }
                  required
                  className="w-full border border-blue-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select time...</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="09:30">9:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="13:30">1:30 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="14:30">2:30 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="15:30">3:30 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="16:30">4:30 PM</option>
                  <option value="17:00">5:00 PM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                Special Instructions (Optional)
              </label>
              <textarea
                value={completionData.pickupNotes}
                onChange={(e) =>
                  setCompletionData((prev) => ({
                    ...prev,
                    pickupNotes: e.target.value,
                  }))
                }
                placeholder="Any special instructions for pickup..."
                rows={3}
                maxLength={500}
                className="w-full border border-blue-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <div className="text-xs text-blue-600 mt-1">
                {completionData.pickupNotes.length}/500 characters
              </div>
            </div>
          </div>
        )}

        {/* Payment Method Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            How would you like to pay? *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cash Option */}
            <label
              className={`
                relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                ${
                  completionData.paymentMethod === "Cash"
                    ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                    : "border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="Cash"
                checked={completionData.paymentMethod === "Cash"}
                onChange={(e) =>
                  setCompletionData((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value,
                  }))
                }
                className="sr-only"
              />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">💵</span>
                  <div>
                    <div className="font-medium text-gray-900">Cash</div>
                    <div className="text-sm text-gray-600">
                      Pay with cash on pickup/delivery
                    </div>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    completionData.paymentMethod === "Cash"
                      ? "border-green-500 bg-green-500"
                      : "border-gray-300"
                  }`}
                >
                  {completionData.paymentMethod === "Cash" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </div>
            </label>

            {/* Card Option */}
            <label
              className={`
                relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                ${
                  completionData.paymentMethod === "Card"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="Card"
                checked={completionData.paymentMethod === "Card"}
                onChange={(e) =>
                  setCompletionData((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value,
                  }))
                }
                className="sr-only"
              />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">💳</span>
                  <div>
                    <div className="font-medium text-gray-900">Card</div>
                    <div className="text-sm text-gray-600">
                      Pay by card on pickup/delivery
                    </div>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    completionData.paymentMethod === "Card"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300"
                  }`}
                >
                  {completionData.paymentMethod === "Card" && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Summary */}
        {completionData.deliveryMethod && completionData.paymentMethod && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-lg font-medium text-gray-900 mb-3">
              📋 Order Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Order Number:</span>
                <span>{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Collection Method:</span>
                <span className="flex items-center">
                  {completionData.deliveryMethod === "Pickup" ? "🚶" : "🚚"}{" "}
                  {completionData.deliveryMethod}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Payment Method:</span>
                <span className="flex items-center">
                  {completionData.paymentMethod === "Cash" ? "💵" : "💳"}{" "}
                  {completionData.paymentMethod}
                </span>
              </div>
              {completionData.deliveryMethod === "Pickup" &&
                completionData.pickupDate &&
                completionData.pickupTime && (
                  <div className="flex justify-between">
                    <span className="font-medium">Scheduled Pickup:</span>
                    <span>
                      {new Date(completionData.pickupDate).toLocaleDateString(
                        "en-AU"
                      )}{" "}
                      at {completionData.pickupTime}
                    </span>
                  </div>
                )}
              {order.price && (
                <div className="flex justify-between pt-2 border-t border-gray-300 font-semibold">
                  <span>Total Amount:</span>
                  <span>${order.price.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={loading}
            disabled={loading || !validateForm()}
          >
            {loading ? "Confirming..." : "Confirm Details"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CompletionModal;
