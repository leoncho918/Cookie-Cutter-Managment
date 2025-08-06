// Enhanced completion modal component with delivery address and payment notifications
// This replaces the completion modal in OrderDetail.js

import React, { useState } from "react";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import PickupDetails from "./PickupDetails";
import {
  COUNTRIES,
  getStateLabel,
  getPostcodeLabel,
  getSuburbLabel,
  validatePostcode,
} from "../../utils/countryHelpers";

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
      // Clear delivery-specific fields if switching to pickup
      ...(method === "Pickup" && {
        deliveryAddress: {
          street: "",
          suburb: "",
          state: "",
          postcode: "",
          country: "",
          instructions: "",
        },
      }),
    }));
  };

  const handlePaymentMethodChange = (method) => {
    setCompletionData((prev) => ({
      ...prev,
      paymentMethod: method,
    }));
  };

  const handleDeliveryAddressChange = (field, value) => {
    setCompletionData((prev) => ({
      ...prev,
      deliveryAddress: {
        ...prev.deliveryAddress,
        [field]: value,
      },
    }));
  };

  const validateForm = () => {
    if (!completionData.deliveryMethod || !completionData.paymentMethod) {
      return false;
    }

    if (completionData.deliveryMethod === "Pickup") {
      return completionData.pickupDate && completionData.pickupTime;
    }

    if (completionData.deliveryMethod === "Delivery") {
      const { deliveryAddress } = completionData;
      if (
        !deliveryAddress ||
        !deliveryAddress.street ||
        !deliveryAddress.suburb ||
        !deliveryAddress.state ||
        !deliveryAddress.postcode ||
        !deliveryAddress.country
      ) {
        return false;
      }

      // Validate postcode format for the selected country
      const postcodeValidation = validatePostcode(
        deliveryAddress.postcode,
        deliveryAddress.country
      );
      if (!postcodeValidation.valid) {
        return false;
      }
    }

    return true;
  };

  const getPaymentNotification = () => {
    if (!completionData.paymentMethod) return null;

    if (completionData.paymentMethod === "Card") {
      return {
        type: "info",
        icon: "💳",
        title: "Card Payment",
        message:
          "An invoice will be sent to your registered email address for card payment processing.",
      };
    } else if (completionData.paymentMethod === "Cash") {
      return {
        type: "warning",
        icon: "💵",
        title: "Cash Payment",
        message: order.price
          ? `Please bring exactly $${order.price.toFixed(
              2
            )}, or as close as possible, as we only carry coins for change.`
          : "Please bring the exact amount, or as close as possible, as we only carry coins for change.",
      };
    }

    return null;
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
                      <strong>Hours:</strong> Mon-Sun 9AM-11:59PM
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
                      <strong>Note:</strong> Please provide your delivery
                      address below
                    </div>
                    <div>
                      Delivery arrangements will be coordinated after
                      confirmation
                    </div>
                    <div>
                      <strong>
                        Please note that a delivery fee will be added to your
                        order total
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Delivery Address Form - Only show if Delivery is selected */}
        {completionData.deliveryMethod === "Delivery" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h4 className="text-lg font-medium text-green-800 mb-4">
              🚚 Delivery Address
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Country Selection - Show first for international support */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Country *
                </label>
                <select
                  value={completionData.deliveryAddress?.country || "Australia"}
                  onChange={(e) =>
                    handleDeliveryAddressChange("country", e.target.value)
                  }
                  required
                  className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={completionData.deliveryAddress?.street || ""}
                  onChange={(e) =>
                    handleDeliveryAddressChange("street", e.target.value)
                  }
                  placeholder="e.g., 123 Main Street"
                  required
                  className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  {getSuburbLabel(
                    completionData.deliveryAddress?.country || "Australia"
                  )}{" "}
                  *
                </label>
                <input
                  type="text"
                  value={completionData.deliveryAddress?.suburb || ""}
                  onChange={(e) =>
                    handleDeliveryAddressChange("suburb", e.target.value)
                  }
                  placeholder={
                    completionData.deliveryAddress?.country === "Australia"
                      ? "e.g., Bankstown"
                      : `Enter ${getSuburbLabel(
                          completionData.deliveryAddress?.country || "Australia"
                        ).toLowerCase()}`
                  }
                  required
                  className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  {getStateLabel(
                    completionData.deliveryAddress?.country || "Australia"
                  )}{" "}
                  *
                </label>
                {completionData.deliveryAddress?.country === "Australia" ? (
                  <select
                    value={completionData.deliveryAddress?.state || ""}
                    onChange={(e) =>
                      handleDeliveryAddressChange("state", e.target.value)
                    }
                    required
                    className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select state...</option>
                    <option value="NSW">New South Wales (NSW)</option>
                    <option value="VIC">Victoria (VIC)</option>
                    <option value="QLD">Queensland (QLD)</option>
                    <option value="WA">Western Australia (WA)</option>
                    <option value="SA">South Australia (SA)</option>
                    <option value="TAS">Tasmania (TAS)</option>
                    <option value="ACT">
                      Australian Capital Territory (ACT)
                    </option>
                    <option value="NT">Northern Territory (NT)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={completionData.deliveryAddress?.state || ""}
                    onChange={(e) =>
                      handleDeliveryAddressChange("state", e.target.value)
                    }
                    placeholder={`Enter ${getStateLabel(
                      completionData.deliveryAddress?.country || "Australia"
                    ).toLowerCase()}`}
                    required
                    className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  {getPostcodeLabel(
                    completionData.deliveryAddress?.country || "Australia"
                  )}{" "}
                  *
                </label>
                <input
                  type="text"
                  value={completionData.deliveryAddress?.postcode || ""}
                  onChange={(e) =>
                    handleDeliveryAddressChange("postcode", e.target.value)
                  }
                  placeholder={(() => {
                    const validation = validatePostcode(
                      "",
                      completionData.deliveryAddress?.country || "Australia"
                    );
                    return validation.example;
                  })()}
                  required
                  className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Delivery Instructions (Optional)
                </label>
                <textarea
                  value={completionData.deliveryAddress?.instructions || ""}
                  onChange={(e) =>
                    handleDeliveryAddressChange("instructions", e.target.value)
                  }
                  placeholder="Any special delivery instructions..."
                  rows={3}
                  maxLength={500}
                  className="w-full border border-green-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                />
                <div className="text-xs text-green-600 mt-1">
                  {(completionData.deliveryAddress?.instructions || "").length}
                  /500 characters
                </div>
              </div>
            </div>

            {/* International Delivery Notice */}
            {completionData.deliveryAddress?.country &&
              completionData.deliveryAddress.country !== "Australia" && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start">
                    <span className="text-blue-600 text-lg mr-2">🌍</span>
                    <div>
                      <h5 className="text-sm font-medium text-blue-800">
                        International Delivery
                      </h5>
                      <p className="text-blue-700 text-sm mt-1">
                        Additional delivery charges and customs duties may apply
                        for international shipments to{" "}
                        {completionData.deliveryAddress.country}. You will be
                        contacted to arrange international shipping details and
                        costs.
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

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
                  <option value="21:00">9:00 PM</option>
                  <option value="21:30">9:30 PM</option>
                  <option value="22:00">10:00 PM</option>
                  <option value="22:30">10:30 PM</option>
                  <option value="23:00">11:00 PM</option>
                  <option value="23:30">11:30 PM</option>
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
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
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
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
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

        {/* Payment Method Notification */}
        {getPaymentNotification() && (
          <div
            className={`p-4 rounded-lg border ${
              getPaymentNotification().type === "warning"
                ? "bg-yellow-50 border-yellow-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-lg">{getPaymentNotification().icon}</span>
              </div>
              <div className="ml-3">
                <h4
                  className={`text-sm font-medium ${
                    getPaymentNotification().type === "warning"
                      ? "text-yellow-800"
                      : "text-blue-800"
                  }`}
                >
                  {getPaymentNotification().title}
                </h4>
                <p
                  className={`mt-1 text-sm ${
                    getPaymentNotification().type === "warning"
                      ? "text-yellow-700"
                      : "text-blue-700"
                  }`}
                >
                  {getPaymentNotification().message}
                </p>
              </div>
            </div>
          </div>
        )}

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

              {completionData.deliveryMethod === "Delivery" &&
                completionData.deliveryAddress &&
                completionData.deliveryAddress.street && (
                  <div className="pt-2 border-t border-gray-300">
                    <span className="font-medium">Delivery Address:</span>
                    <div className="text-xs text-gray-600 mt-1">
                      {completionData.deliveryAddress.street}
                      <br />
                      {completionData.deliveryAddress.suburb}{" "}
                      {completionData.deliveryAddress.state}{" "}
                      {completionData.deliveryAddress.postcode}
                      <br />
                      {completionData.deliveryAddress.country}
                      {completionData.deliveryAddress.instructions && (
                        <div className="mt-1">
                          <strong>Instructions:</strong>{" "}
                          {completionData.deliveryAddress.instructions}
                        </div>
                      )}
                    </div>
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
