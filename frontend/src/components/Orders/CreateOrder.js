// src/components/Orders/CreateOrder.js - Create new order component
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { ITEM_TYPES } from "../../utils/orderHelpers";
import Button from "../UI/Button";
import LoadingSpinner from "../UI/LoadingSpinner";
import axios from "axios";

const CreateOrder = () => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState({
    dateRequired: "",
    items: [
      {
        type: ITEM_TYPES.CUTTER,
        additionalComments: "",
      },
    ],
  });

  // Only bakers can create orders
  if (user.role !== "baker") {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">Only bakers can create orders.</p>
      </div>
    );
  }

  const handleDateChange = (date) => {
    setOrderData((prev) => ({
      ...prev,
      dateRequired: date,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setOrderData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setOrderData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          type: ITEM_TYPES.CUTTER,
          additionalComments: "",
        },
      ],
    }));
  };

  const removeItem = (index) => {
    if (orderData.items.length > 1) {
      setOrderData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const validateForm = () => {
    if (!orderData.dateRequired) {
      showError("Please select a required date");
      return false;
    }

    const selectedDate = new Date(orderData.dateRequired);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      showError("Required date cannot be in the past");
      return false;
    }

    if (orderData.items.length === 0) {
      showError("Please add at least one item");
      return false;
    }

    for (let i = 0; i < orderData.items.length; i++) {
      const item = orderData.items[i];
      if (!item.type) {
        showError(`Please select a type for item ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await axios.post("/orders", orderData);

      showSuccess("Order created successfully!");
      navigate(`/orders/${response.data.order._id}`);
    } catch (error) {
      console.error("Error creating order:", error);
      showError(error.response?.data?.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!orderData.dateRequired) {
      showError("Please select a required date before saving");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post("/orders", orderData);

      showSuccess("Draft order saved successfully!");
      navigate(`/orders/${response.data.order._id}`);
    } catch (error) {
      console.error("Error saving draft:", error);
      showError(error.response?.data?.message || "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
          <p className="text-gray-600 mt-1">
            Create a new cookie cutter order with multiple items
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate("/orders")}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Order Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Baker ID
              </label>
              <input
                type="text"
                value={user.bakerId}
                disabled
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Date *
              </label>
              <input
                type="date"
                value={orderData.dateRequired}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Order Items</h2>
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              disabled={loading}
            >
              Add Item
            </Button>
          </div>

          <div className="space-y-6">
            {orderData.items.map((item, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-medium text-gray-800">
                    Item {index + 1}
                  </h3>

                  {orderData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                      disabled={loading}
                    >
                      Remove Item
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Type *
                    </label>
                    <select
                      value={item.type}
                      onChange={(e) =>
                        handleItemChange(index, "type", e.target.value)
                      }
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.values(ITEM_TYPES).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Comments
                    </label>
                    <textarea
                      value={item.additionalComments}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "additionalComments",
                          e.target.value
                        )
                      }
                      placeholder="Describe your requirements, size, special features..."
                      rows={3}
                      maxLength={1000}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {item.additionalComments.length}/1000 characters
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>📸 Important:</strong> You will need to upload at
                    least one inspiration image for each item before you can
                    submit the order. Images help us understand your vision
                    better!
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p>
                • Orders are created in <strong>Draft</strong> status
              </p>
              <p>• You can edit and add images before submitting</p>
              <p>• Submit when ready for admin review</p>
            </div>

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                loading={loading}
                disabled={loading}
              >
                Save as Draft
              </Button>

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Order"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Need Help?</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">Item Types</h4>
            <ul className="text-gray-600 space-y-1">
              <li>
                • <strong>Cutter:</strong> Cookie cutting shape only
              </li>
              <li>
                • <strong>Stamp:</strong> Embossing/imprinting design only
              </li>
              <li>
                • <strong>Stamp & Cutter:</strong> Combined cutting and stamping
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Order Process</h4>
            <ul className="text-gray-600 space-y-1">
              <li>• Create order with items</li>
              <li>• Add inspiration images</li>
              <li>• Submit for review</li>
              <li>• Approve final design & pricing</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Tips</h4>
            <ul className="text-gray-600 space-y-1">
              <li>• Be specific in comments</li>
              <li>• Include size requirements</li>
              <li>• Mention special features</li>
              <li>• Upload clear reference images</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;
