// src/components/Orders/OrderDetail.js - Enhanced with baker editing in Draft and Requested Changes stages
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import {
  ORDER_STAGES,
  ITEM_TYPES,
  DELIVERY_METHODS,
  PAYMENT_METHODS,
  MEASUREMENT_UNITS,
  getStageColor,
  formatDate,
  formatMeasurement,
  validateMeasurement,
  getNextAllowedStages,
  canEditOrder,
  canDeleteOrder,
  formatDateTime,
  formatDateForInput,
} from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import axios from "axios";

const OrderDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();
  const navigate = useNavigate();

  // Socket.IO integration
  const {
    isConnected,
    socket,
    joinOrderRoom,
    leaveOrderRoom,
    subscribeToOrderUpdates,
    subscribeToImageUpdates,
    reconnect,
  } = useSocket();

  // Use ref to track if upload is in progress
  const uploadInProgressRef = useRef(false);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [stageModal, setStageModal] = useState({
    isOpen: false,
    targetStage: "",
    price: "",
    comments: "",
  });
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    imageUrl: "",
    imageTitle: "",
  });
  const [completionModal, setCompletionModal] = useState({
    isOpen: false,
    deliveryMethod: "",
    paymentMethod: "",
    pickupDate: "",
    pickupTime: "",
    pickupNotes: "",
  });
  const [uploadingImages, setUploadingImages] = useState({});
  const [addItemModal, setAddItemModal] = useState({
    isOpen: false,
    type: ITEM_TYPES.CUTTER,
    measurement: {
      value: "",
      unit: MEASUREMENT_UNITS.CM,
    },
    additionalComments: "",
  });

  useEffect(() => {
    if (id) {
      loadOrder();
    }
  }, [id]);

  // Join order room for real-time updates
  useEffect(() => {
    if (id && isConnected) {
      console.log("🏠 Joining order room for real-time updates:", id);
      joinOrderRoom(id);

      return () => {
        console.log("🚪 Leaving order room:", id);
        leaveOrderRoom(id);
      };
    }
  }, [id, isConnected, joinOrderRoom, leaveOrderRoom]);

  // Enhanced Socket.IO integration with comprehensive event handling
  useEffect(() => {
    if (!isConnected) return;

    console.log("🔌 Setting up enhanced socket listeners for order:", id);

    // Subscribe to order updates with enhanced handling
    const unsubscribeOrder = subscribeToOrderUpdates((updateData) => {
      console.log("📡 Received order update:", updateData);

      // Only process updates for the current order
      if (updateData.orderId === id) {
        const { eventType, updatedBy, order: updatedOrder } = updateData;

        // Handle deletion immediately to prevent rendering errors
        if (eventType === "deleted") {
          console.log("🗑️ Order deleted, redirecting to orders list");
          setOrder(null); // Clear order data immediately
          showInfo("This order has been deleted");
          navigate("/orders");
          return;
        }

        // Don't show notifications for updates made by the current user
        const isOwnUpdate = updatedBy.email === user.email;

        if (!isOwnUpdate) {
          // Show different messages based on event type
          let message = "";
          switch (eventType) {
            case "updated":
              message = `Order updated by ${updatedBy.email}`;
              break;
            case "stage_changed":
              message = `Order stage changed to "${updatedOrder.stage}" by ${updatedBy.email}`;
              break;
            case "item_added":
              message = `New item added by ${updatedBy.email}`;
              break;
            case "item_updated":
              message = `Item updated by ${updatedBy.email}`;
              break;
            case "item_deleted":
              message = `Item deleted by ${updatedBy.email}`;
              break;
            case "completion_updated":
              message = `Completion details updated by ${updatedBy.email}`;
              break;
            default:
              message = `Order ${eventType.replace("_", " ")} by ${
                updatedBy.email
              }`;
          }
          showInfo(message);
        }

        // Update the order data
        if (updatedOrder) {
          setOrder(updatedOrder);
        } else {
          // Otherwise refresh the order data
          loadOrder();
        }
      }
    });

    // Subscribe to image updates with enhanced handling
    const unsubscribeImage = subscribeToImageUpdates((updateData) => {
      console.log("📡 Received image update:", updateData);

      // Only process updates for the current order
      if (updateData.orderId === id) {
        const { eventType, imageType, updatedBy } = updateData;

        // Don't show notifications for updates made by the current user
        if (updatedBy.email !== user.email) {
          const action =
            eventType === "image_uploaded" ? "uploaded" : "deleted";
          const message = `${imageType} image ${action} by ${updatedBy.email}`;
          showInfo(message);
        }

        // Always refresh order data to show updated images, regardless of who made the change
        console.log("🖼️ Image update detected, refreshing order data");
        loadOrderAfterUpload();
      }
    });

    // Subscribe to order-specific events
    const handleOrderDeleted = (data) => {
      if (data.orderId === id) {
        console.log("🗑️ Order deleted event received:", data);
        setOrder(null); // Clear order data immediately
        showInfo(`Order ${data.orderNumber} has been deleted`);
        navigate("/orders");
      }
    };

    const handleOrderStageChanged = (data) => {
      if (data.orderId === id && data.changedBy.email !== user.email) {
        showSuccess(`Order stage changed to: ${data.newStage}`);
      }
    };

    const handleOrderItemsChanged = (data) => {
      if (data.orderId === id && data.updatedBy.email !== user.email) {
        const eventMessages = {
          item_added: "New item added to order",
          item_updated: "Order item updated",
          item_deleted: "Item removed from order",
        };
        showInfo(eventMessages[data.eventType] || "Order items changed");
      }
    };

    const handleOrderImagesChanged = (data) => {
      if (data.orderId === id) {
        console.log(
          "🖼️ Order images changed event received, refreshing display"
        );
        // Use the specialized refresh function for better handling
        loadOrderAfterUpload();
      }
    };

    const handleOrderRefreshRequested = (data) => {
      if (data.orderId === id) {
        console.log("🔄 Order refresh requested by another user");
        loadOrder();
      }
    };

    // Set up Socket.IO event listeners
    if (socket) {
      socket.on("order-deleted", handleOrderDeleted);
      socket.on("order-stage-changed", handleOrderStageChanged);
      socket.on("order-items-changed", handleOrderItemsChanged);
      socket.on("order-images-changed", handleOrderImagesChanged);
      socket.on("order-refresh-requested", handleOrderRefreshRequested);
    }

    return () => {
      console.log("🔌 Cleaning up enhanced socket listeners");

      if (unsubscribeOrder) unsubscribeOrder();
      if (unsubscribeImage) unsubscribeImage();

      if (socket) {
        socket.off("order-deleted", handleOrderDeleted);
        socket.off("order-stage-changed", handleOrderStageChanged);
        socket.off("order-items-changed", handleOrderItemsChanged);
        socket.off("order-images-changed", handleOrderImagesChanged);
        socket.off("order-refresh-requested", handleOrderRefreshRequested);
      }
    };
  }, [
    id,
    isConnected,
    socket,
    subscribeToOrderUpdates,
    subscribeToImageUpdates,
    user.email,
    showInfo,
    showSuccess,
    navigate,
  ]);

  // Enhanced load order function with retry logic
  const loadOrderWithRetry = async (retryCount = 0) => {
    const maxRetries = 3;

    // Don't reload if upload is in progress
    if (uploadInProgressRef.current) {
      console.log("🚫 Skipping order reload - upload in progress");
      return;
    }

    try {
      setLoading(true);
      console.log(
        `🔄 Loading order with ID: ${id} (attempt ${retryCount + 1})`
      );

      const response = await axios.get(`/orders/${id}`);
      console.log("✅ Order loaded successfully");
      setOrder(response.data);

      // Reset retry count on successful load
      setLoading(false);
    } catch (error) {
      console.error(
        `❌ Error loading order (attempt ${retryCount + 1}):`,
        error
      );

      if (retryCount < maxRetries && error.response?.status !== 404) {
        // Retry with exponential backoff for non-404 errors
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms...`);

        setTimeout(() => {
          loadOrderWithRetry(retryCount + 1);
        }, delay);
      } else {
        setLoading(false);

        if (error.response?.status === 404) {
          showError("Order not found");
          navigate("/orders");
        } else {
          showError("Failed to load order details");
          if (retryCount >= maxRetries) {
            showError("Multiple attempts failed. Please refresh the page.");
          }
        }
      }
    }
  };

  // Use the enhanced load order function
  const loadOrder = loadOrderWithRetry;

  const handleStageChange = async () => {
    const { targetStage, price, comments } = stageModal;

    try {
      setActionLoading(true);

      const payload = { stage: targetStage, comments };
      if (targetStage === ORDER_STAGES.REQUIRES_APPROVAL && price) {
        payload.price = parseFloat(price);
      }

      await axios.put(`/orders/${id}/stage`, payload);

      showSuccess(`Order stage updated to ${targetStage}`);
      loadOrder();
      setStageModal({
        isOpen: false,
        targetStage: "",
        price: "",
        comments: "",
      });
    } catch (error) {
      console.error("Error updating stage:", error);
      showError(
        error.response?.data?.message || "Failed to update order stage"
      );
    } finally {
      setActionLoading(false);
    }
  };

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
      const selectedDate = new Date(`${pickupDate}T${pickupTime}`);
      const now = new Date();
      if (selectedDate < now) {
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

      await axios.put(`/orders/${id}/completion`, payload);

      showSuccess("Completion details updated successfully");
      loadOrder();
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

  const handleItemUpdate = async (itemId, updates) => {
    try {
      await axios.put(`/orders/${id}/items/${itemId}`, updates);
      showSuccess("Item updated successfully");
      loadOrder();
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating item:", error);
      showError(error.response?.data?.message || "Failed to update item");
    }
  };

  const handleItemDelete = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await axios.delete(`/orders/${id}/items/${itemId}`);
        showSuccess("Item deleted successfully");
        loadOrder();
      } catch (error) {
        console.error("Error deleting item:", error);
        showError(error.response?.data?.message || "Failed to delete item");
      }
    }
  };

  const handleAddItem = async () => {
    const { type, measurement, additionalComments } = addItemModal;

    // Validate measurement
    const measurementValidation = validateMeasurement(measurement);
    if (!measurementValidation.valid) {
      showError(measurementValidation.message);
      return;
    }

    try {
      setActionLoading(true);

      await axios.post(`/orders/${id}/items`, {
        type,
        measurement,
        additionalComments,
      });

      showSuccess("Item added successfully");
      loadOrder();
      setAddItemModal({
        isOpen: false,
        type: ITEM_TYPES.CUTTER,
        measurement: {
          value: "",
          unit: MEASUREMENT_UNITS.CM,
        },
        additionalComments: "",
      });
    } catch (error) {
      console.error("Error adding item:", error);
      showError(error.response?.data?.message || "Failed to add item");
    } finally {
      setActionLoading(false);
    }
  };

  // FIXED: Complete handleOrderDelete function
  const handleOrderDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this entire order? This action cannot be undone."
      )
    ) {
      try {
        console.log("🗑️ Initiating order deletion:", id);
        setLoading(true); // Show loading state during deletion

        await axios.delete(`/orders/${id}`);

        console.log("✅ Order deleted successfully");
        showSuccess("Order deleted successfully");

        // Clear order state and navigate immediately
        setOrder(null);
        navigate("/orders");
      } catch (error) {
        console.error("❌ Error deleting order:", error);
        showError(error.response?.data?.message || "Failed to delete order");
        setLoading(false); // Reset loading state on error
      }
    }
  };

  // Enhanced image upload with progress tracking
  const handleImageUploadWithProgress = async (files, itemId, imageType) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    console.log("🔍 Enhanced image upload started:", {
      fileCount: fileArray.length,
      itemId,
      imageType,
      orderId: id,
    });

    try {
      // Set upload in progress flag
      uploadInProgressRef.current = true;

      setUploadingImages((prev) => ({
        ...prev,
        [`${itemId}-${imageType}`]: true,
      }));

      let successCount = 0;
      let failedFiles = [];

      // Show initial progress
      if (fileArray.length > 1) {
        showInfo(`Uploading ${fileArray.length} image(s)...`);
      }

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const progress = Math.round(((i + 1) / fileArray.length) * 100);

        console.log(
          `📤 Uploading ${i + 1}/${fileArray.length}: ${
            file.name
          } (${progress}%)`
        );

        try {
          const formData = new FormData();
          formData.append("image", file);

          const response = await axios.post(
            `/upload/${imageType}/${id}/${itemId}`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 30000,
            }
          );

          console.log(`✅ Upload response for ${file.name}:`, response.data);
          successCount++;

          // Show progress for multiple files
          if (fileArray.length > 1) {
            showInfo(`Uploaded ${successCount}/${fileArray.length} images`);
          }
        } catch (fileError) {
          console.error(`❌ Failed to upload ${file.name}:`, fileError);
          failedFiles.push(file.name);
        }

        // Small delay between uploads to prevent overwhelming
        if (i < fileArray.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Final success/error messages
      if (successCount > 0) {
        const message =
          successCount === fileArray.length
            ? fileArray.length === 1
              ? "Image uploaded successfully!"
              : `All ${fileArray.length} image(s) uploaded successfully!`
            : `${successCount} of ${fileArray.length} image(s) uploaded successfully`;
        showSuccess(message);

        // Force refresh order data to show new images
        console.log("🔄 Refreshing order data to show new images...");
        await loadOrderAfterUpload();
      } else {
        showError(`Failed to upload any images`);
      }

      if (failedFiles.length > 0) {
        showError(`Failed to upload: ${failedFiles.join(", ")}`);
      }
    } catch (error) {
      console.error("❌ Upload process failed:", error);
      showError("Upload process failed");
    } finally {
      uploadInProgressRef.current = false;
      setUploadingImages((prev) => ({
        ...prev,
        [`${itemId}-${imageType}`]: false,
      }));
    }
  };

  // Separate function to load order after upload completes
  const loadOrderAfterUpload = async () => {
    try {
      console.log("🔄 Loading updated order data after upload");

      // Add a delay to ensure backend has processed the upload
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await axios.get(`/orders/${id}`);
      setOrder(response.data);

      console.log(
        "✅ Order data refreshed successfully - new image count:",
        response.data.items.reduce(
          (total, item) =>
            total +
            (item.inspirationImages?.length || 0) +
            (item.previewImages?.length || 0),
          0
        )
      );
    } catch (error) {
      console.error("❌ Error refreshing order data:", error);
      // Don't show error to user as upload was successful
      console.warn(
        "Upload was successful but couldn't refresh display immediately"
      );
    }
  };

  const handleImageUpload = handleImageUploadWithProgress;

  const handleImageDelete = async (itemId, imageKey, imageType) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      try {
        console.log("🗑️ Deleting image:", {
          itemId,
          imageKey,
          imageType,
          orderId: id,
        });

        // Use the unified delete endpoint
        const response = await axios.post(`/upload/delete`, {
          orderId: id,
          itemId: itemId,
          imageKey: imageKey,
          imageType: imageType,
        });

        console.log("✅ Delete response:", response.data);
        showSuccess("Image deleted successfully");
        loadOrder();
      } catch (error) {
        console.error("❌ Error deleting image:", error);
        showError(error.response?.data?.message || "Failed to delete image");
      }
    }
  };

  // Enhanced permission checks for baker editing
  const canBakerEdit = () => {
    return (
      user.role === "baker" &&
      order.bakerId === user.bakerId &&
      (order.stage === ORDER_STAGES.DRAFT ||
        order.stage === ORDER_STAGES.REQUESTED_CHANGES)
    );
  };

  const canUploadInspirationImages = () => {
    return canBakerEdit() || user.role === "admin";
  };

  const canUploadPreviewImages = () => {
    return user.role === "admin";
  };

  const canDeleteInspirationImages = () => {
    return canBakerEdit() || user.role === "admin";
  };

  const canDeletePreviewImages = () => {
    return user.role === "admin";
  };

  const canAddItems = () => {
    return canBakerEdit();
  };

  const canEditItems = () => {
    return canBakerEdit() || user.role === "admin";
  };

  const canDeleteItems = () => {
    return canBakerEdit() || user.role === "admin";
  };

  // Enhanced connection status display
  const renderConnectionStatus = () => {
    return (
      <div className="flex items-center space-x-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-xs text-gray-500">
          {isConnected ? "Live updates active" : "Offline - updates paused"}
        </span>
        {!isConnected && (
          <button
            onClick={() => {
              console.log("🔄 Manual reconnect requested");
              reconnect();
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900">Order Not Found</h1>
        <p className="text-gray-600 mt-2">
          The order you're looking for doesn't exist.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate("/orders")}
          className="mt-4"
        >
          Back to Orders
        </Button>
      </div>
    );
  }

  const nextAllowedStages = getNextAllowedStages(order.stage, user.role);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Order {order.orderNumber}
          </h1>
          <p className="text-gray-600 mt-1">
            Created {formatDate(order.createdAt)} • Due{" "}
            {formatDate(order.dateRequired)}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Enhanced Connection Status Indicator */}
          {renderConnectionStatus()}

          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => navigate("/orders")}>
              Back to Orders
            </Button>

            {canDeleteOrder(order, user) && (
              <Button variant="danger" onClick={handleOrderDelete}>
                Delete Order
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Baker Edit Notice */}
      {canBakerEdit() && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-blue-500 text-lg">✏️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Editing Enabled
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                <p>
                  You can edit item properties, upload/delete inspiration
                  images, and add/remove items while your order is in{" "}
                  <strong>{order.stage}</strong> stage.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Order Status</h2>

          <span
            className={`
                        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                        bg-${getStageColor(
                          order.stage
                        )}-100 text-${getStageColor(order.stage)}-800
                    `}
          >
            {order.stage}
          </span>
        </div>

        {/* Stage Progression */}
        <div className="relative mb-6">
          <div className="flex items-center justify-between">
            {Object.values(ORDER_STAGES).map((stage, index) => {
              const isCompleted =
                Object.values(ORDER_STAGES).indexOf(order.stage) >= index;
              const isCurrent = order.stage === stage;

              return (
                <div
                  key={stage}
                  className="flex flex-col items-center relative"
                >
                  <div
                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                                        ${
                                          isCurrent &&
                                          order.stage !== ORDER_STAGES.COMPLETED
                                            ? `bg-blue-600 text-white`
                                            : isCompleted
                                            ? "bg-green-600 text-white"
                                            : "bg-gray-300 text-gray-600"
                                        }
                                    `}
                  >
                    {isCompleted && !isCurrent ? "✓" : index + 1}
                  </div>
                  <div className="text-xs text-center mt-2 max-w-25">
                    {stage}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Actions */}
        {nextAllowedStages.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">Available actions:</span>
              {nextAllowedStages.map((stage) => {
                // Check if baker is trying to submit without inspiration images
                const isSubmitting =
                  stage === ORDER_STAGES.SUBMITTED && user.role === "baker";
                const missingImages = isSubmitting
                  ? order?.items?.filter(
                      (item) =>
                        !item.inspirationImages ||
                        item.inspirationImages.length === 0
                    ) || []
                  : [];
                const canSubmit = !isSubmitting || missingImages.length === 0;

                return (
                  <Button
                    key={stage}
                    variant="primary"
                    size="small"
                    onClick={() => {
                      if (!canSubmit) {
                        showError(
                          `Please upload at least one inspiration image for all items before submitting. Missing images for ${missingImages.length} item(s).`
                        );
                        return;
                      }
                      setStageModal({
                        isOpen: true,
                        targetStage: stage,
                        price:
                          stage === ORDER_STAGES.REQUIRES_APPROVAL
                            ? order.price || ""
                            : "",
                        comments: "",
                      });
                    }}
                    disabled={!canSubmit}
                    className={
                      !canSubmit ? "opacity-50 cursor-not-allowed" : ""
                    }
                  >
                    {stage === ORDER_STAGES.SUBMITTED
                      ? "Submit Order"
                      : stage === ORDER_STAGES.READY_TO_PRINT
                      ? "Approve Order"
                      : stage === ORDER_STAGES.REQUESTED_CHANGES
                      ? "Request Changes"
                      : `Move to ${stage}`}
                  </Button>
                );
              })}
            </div>

            {/* Show warning if trying to submit without images */}
            {user.role === "baker" &&
              order?.stage === ORDER_STAGES.DRAFT &&
              (() => {
                const itemsWithoutImages =
                  order?.items?.filter(
                    (item) =>
                      !item.inspirationImages ||
                      item.inspirationImages.length === 0
                  ) || [];
                return (
                  itemsWithoutImages.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <span className="text-yellow-400">⚠️</span>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Inspiration Images Required
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              You need to upload at least one inspiration image
                              for each item before you can submit this order.
                            </p>
                            <p className="mt-1">
                              <strong>Items missing images:</strong>{" "}
                              {itemsWithoutImages.length} of{" "}
                              {order?.items?.length || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                );
              })()}
          </div>
        )}

        {/* Completion Details */}
        {order.stage === ORDER_STAGES.COMPLETED && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Completion Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Delivery Method:
                </span>
                <span className="ml-2 text-sm text-gray-900">
                  {order.deliveryMethod || "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Payment Method:
                </span>
                <span className="ml-2 text-sm text-gray-900">
                  {order.paymentMethod || "Not specified"}
                </span>
              </div>
            </div>

            {/* Pickup Schedule Details */}
            {order.deliveryMethod === "Pickup" && order.pickupSchedule && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h5 className="text-sm font-medium text-blue-800 mb-2">
                  📅 Pickup Schedule
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-sm font-medium text-blue-700">
                      Date:
                    </span>
                    <span className="ml-2 text-sm text-blue-900">
                      {order.pickupSchedule.date
                        ? formatDate(order.pickupSchedule.date)
                        : "Not scheduled"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-700">
                      Time:
                    </span>
                    <span className="ml-2 text-sm text-blue-900">
                      {order.pickupSchedule.time || "Not specified"}
                    </span>
                  </div>
                </div>
                {order.pickupSchedule.notes && (
                  <div className="mt-2">
                    <span className="text-sm font-medium text-blue-700">
                      Notes:
                    </span>
                    <p className="text-sm text-blue-900 mt-1">
                      {order.pickupSchedule.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {user.role === "baker" &&
              order.bakerId === user.bakerId &&
              (!order.deliveryMethod || !order.paymentMethod) && (
                <Button
                  variant="primary"
                  size="small"
                  className="mt-3"
                  onClick={() =>
                    setCompletionModal({
                      isOpen: true,
                      deliveryMethod: order.deliveryMethod || "",
                      paymentMethod: order.paymentMethod || "",
                      pickupDate: order.pickupSchedule?.date
                        ? formatDateForInput(order.pickupSchedule.date)
                        : "",
                      pickupTime: order.pickupSchedule?.time || "",
                      pickupNotes: order.pickupSchedule?.notes || "",
                    })
                  }
                >
                  {order.deliveryMethod && order.paymentMethod
                    ? "Update Details"
                    : "Confirm Details"}
                </Button>
              )}
          </div>
        )}
      </div>

      {/* Order Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Order Information
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                Order Number:
              </span>
              <span className="text-sm text-gray-900">{order.orderNumber}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">Baker:</span>
              <span className="text-sm text-gray-900">
                {order.bakerId} ({order.bakerEmail})
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                Created:
              </span>
              <span className="text-sm text-gray-900">
                {formatDateTime(order.createdAt)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                Required Date:
              </span>
              <span className="text-sm text-gray-900">
                {formatDate(order.dateRequired)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">
                Total Items:
              </span>
              <span className="text-sm text-gray-900">
                {order?.items?.length || 0}
              </span>
            </div>

            {order.price && (
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Price:
                </span>
                <span className="text-sm text-gray-900 font-semibold">
                  ${order.price.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stage History */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Stage History
          </h3>

          <div className="space-y-3">
            {order.stageHistory && order.stageHistory.length > 0 ? (
              order.stageHistory.map((history, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div
                    className={`
                                        w-2 h-2 rounded-full mt-2
                                        bg-${getStageColor(history.stage)}-600
                                    `}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {history.stage}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(history.changedAt)}
                    </div>
                    {history.comments && (
                      <div className="text-sm text-gray-600 mt-1">
                        {history.comments}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">
                No stage changes yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Order Items</h3>

          {/* Add Item Button for Bakers in editable stages */}
          {canAddItems() && (
            <Button
              variant="primary"
              size="small"
              onClick={() =>
                setAddItemModal({
                  isOpen: true,
                  type: ITEM_TYPES.CUTTER,
                  measurement: {
                    value: "",
                    unit: MEASUREMENT_UNITS.CM,
                  },
                  additionalComments: "",
                })
              }
            >
              Add Item
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {order?.items && order.items.length > 0 ? (
            order.items.map((item, index) => (
              <div
                key={item._id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-800">
                    Item {index + 1}: {item.type}
                  </h4>

                  {canEditItems() && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingItem(item._id)}
                        className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
                        disabled={!canEditItems()}
                      >
                        Edit
                      </button>
                      {canDeleteItems() && order.items.length > 1 && (
                        <button
                          onClick={() => handleItemDelete(item._id)}
                          className="text-red-600 hover:text-red-800 text-sm transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editingItem === item._id ? (
                  <EditItemForm
                    item={item}
                    onSave={(updates) => handleItemUpdate(item._id, updates)}
                    onCancel={() => setEditingItem(null)}
                    canEdit={canEditItems()}
                  />
                ) : (
                  <>
                    {/* Item Details */}
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">
                          Measurement:
                        </h5>
                        <p className="text-sm text-gray-900">
                          {item.measurement
                            ? formatMeasurement(item.measurement)
                            : "Not specified (legacy item)"}
                        </p>
                      </div>

                      {item.additionalComments && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">
                            Comments:
                          </h5>
                          <p className="text-sm text-gray-600">
                            {item.additionalComments}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Inspiration Images */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700">
                            Inspiration Images:
                          </h5>
                          {canUploadInspirationImages() && (
                            <p className="text-xs text-gray-500 mt-1">
                              {canBakerEdit()
                                ? "You can upload and delete inspiration images while in this stage"
                                : user.role === "admin"
                                ? "As admin, you can upload and delete inspiration images at any time"
                                : "Upload inspiration images to help us understand your vision"}
                            </p>
                          )}
                        </div>
                        {canUploadInspirationImages() && (
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const selectedFiles = e.target.files;
                                console.log("📁 Files selected:", {
                                  count: selectedFiles
                                    ? selectedFiles.length
                                    : 0,
                                  files: selectedFiles
                                    ? Array.from(selectedFiles).map((f) => ({
                                        name: f.name,
                                        size: f.size,
                                        type: f.type,
                                      }))
                                    : [],
                                });

                                if (selectedFiles && selectedFiles.length > 0) {
                                  handleImageUpload(
                                    selectedFiles,
                                    item._id,
                                    "inspiration"
                                  );
                                  // Reset input so same files can be selected again
                                  e.target.value = "";
                                } else {
                                  console.log("❌ No files selected");
                                }
                              }}
                              style={{ display: "none" }}
                              id={`inspiration-upload-${item._id}`}
                            />
                            <Button
                              variant="outline"
                              size="small"
                              loading={
                                uploadingImages[`${item._id}-inspiration`]
                              }
                              onClick={() => {
                                console.log(
                                  "Upload button clicked for item:",
                                  item._id
                                );
                                const input = document.getElementById(
                                  `inspiration-upload-${item._id}`
                                );
                                if (input) {
                                  input.click();
                                } else {
                                  console.error("File input not found");
                                }
                              }}
                              disabled={
                                uploadingImages[`${item._id}-inspiration`] ||
                                uploadInProgressRef.current
                              }
                            >
                              {uploadingImages[`${item._id}-inspiration`]
                                ? "Uploading..."
                                : "Upload Images"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <ImageGallery
                        images={item.inspirationImages}
                        onDelete={(imageKey) =>
                          handleImageDelete(item._id, imageKey, "inspiration")
                        }
                        onImageClick={(imageUrl) =>
                          setImageModal({
                            isOpen: true,
                            imageUrl,
                            imageTitle: `Inspiration Image - Item ${index + 1}`,
                          })
                        }
                        canDelete={canDeleteInspirationImages()}
                        imageType="inspiration image"
                      />
                    </div>

                    {/* Preview Images */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-medium text-gray-700">
                            Preview Images:
                          </h5>
                          {canDeletePreviewImages() && (
                            <p className="text-xs text-gray-500 mt-1">
                              As admin, you can upload and delete preview images
                            </p>
                          )}
                        </div>
                        {canUploadPreviewImages() && (
                          <div>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const selectedFiles = e.target.files;
                                console.log("📁 Preview files selected:", {
                                  count: selectedFiles
                                    ? selectedFiles.length
                                    : 0,
                                  files: selectedFiles
                                    ? Array.from(selectedFiles).map((f) => ({
                                        name: f.name,
                                        size: f.size,
                                        type: f.type,
                                      }))
                                    : [],
                                });

                                if (selectedFiles && selectedFiles.length > 0) {
                                  handleImageUpload(
                                    selectedFiles,
                                    item._id,
                                    "preview"
                                  );
                                  // Reset input so same files can be selected again
                                  e.target.value = "";
                                } else {
                                  console.log("❌ No preview files selected");
                                }
                              }}
                              style={{ display: "none" }}
                              id={`preview-upload-${item._id}`}
                            />
                            <Button
                              variant="outline"
                              size="small"
                              loading={uploadingImages[`${item._id}-preview`]}
                              onClick={() => {
                                console.log(
                                  "Preview upload button clicked for item:",
                                  item._id
                                );
                                const input = document.getElementById(
                                  `preview-upload-${item._id}`
                                );
                                if (input) {
                                  input.click();
                                } else {
                                  console.error("Preview file input not found");
                                }
                              }}
                              disabled={
                                uploadingImages[`${item._id}-preview`] ||
                                uploadInProgressRef.current
                              }
                            >
                              {uploadingImages[`${item._id}-preview`]
                                ? "Uploading..."
                                : "Upload Previews"}
                            </Button>
                          </div>
                        )}
                      </div>

                      <ImageGallery
                        images={item.previewImages}
                        onDelete={(imageKey) =>
                          handleImageDelete(item._id, imageKey, "preview")
                        }
                        onImageClick={(imageUrl) =>
                          setImageModal({
                            isOpen: true,
                            imageUrl,
                            imageTitle: `Preview Image - Item ${index + 1}`,
                          })
                        }
                        canDelete={canDeletePreviewImages()}
                        imageType="preview image"
                      />
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No items in this order.</p>
              {canAddItems() && (
                <Button
                  variant="primary"
                  onClick={() =>
                    setAddItemModal({
                      isOpen: true,
                      type: ITEM_TYPES.CUTTER,
                      measurement: {
                        value: "",
                        unit: MEASUREMENT_UNITS.CM,
                      },
                      additionalComments: "",
                    })
                  }
                  className="mt-4"
                >
                  Add First Item
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stage Change Modal */}
      <Modal
        isOpen={stageModal.isOpen}
        onClose={() =>
          setStageModal({
            isOpen: false,
            targetStage: "",
            price: "",
            comments: "",
          })
        }
        title={`Move to ${stageModal.targetStage}`}
        size="medium"
      >
        <div className="space-y-4">
          {stageModal.targetStage === ORDER_STAGES.REQUIRES_APPROVAL && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Price *
              </label>
              <input
                type="number"
                value={stageModal.price}
                onChange={(e) =>
                  setStageModal((prev) => ({ ...prev, price: e.target.value }))
                }
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments (Optional)
            </label>
            <textarea
              value={stageModal.comments}
              onChange={(e) =>
                setStageModal((prev) => ({ ...prev, comments: e.target.value }))
              }
              placeholder="Add any comments about this stage change..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setStageModal({
                  isOpen: false,
                  targetStage: "",
                  price: "",
                  comments: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleStageChange}
              loading={actionLoading}
            >
              Update Stage
            </Button>
          </div>
        </div>
      </Modal>

      {/* Completion Modal */}
      <Modal
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
        title="Completion Details"
        size="large"
      >
        <div className="space-y-6">
          {/* Delivery Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Method *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(DELIVERY_METHODS).map((method) => (
                <label
                  key={method}
                  className={`
              relative flex items-center p-4 border rounded-lg cursor-pointer transition-colors
              ${
                completionModal.deliveryMethod === method
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:bg-gray-50"
              }
            `}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value={method}
                    checked={completionModal.deliveryMethod === method}
                    onChange={(e) =>
                      setCompletionModal((prev) => ({
                        ...prev,
                        deliveryMethod: e.target.value,
                      }))
                    }
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div
                      className={`
                  w-4 h-4 rounded-full border-2 mr-3
                  ${
                    completionModal.deliveryMethod === method
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300"
                  }
                `}
                    >
                      {completionModal.deliveryMethod === method && (
                        <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {method === "Pickup" ? "🚶 Pickup" : "🚚 Delivery"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {method === "Pickup"
                          ? "I will collect the order"
                          : "Please deliver the order"}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Pickup Schedule - Only show if Pickup is selected */}
          {completionModal.deliveryMethod === "Pickup" && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-lg font-medium text-blue-800 mb-4">
                📅 Schedule Pickup
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Pickup Date *
                  </label>
                  <input
                    type="date"
                    value={completionModal.pickupDate}
                    onChange={(e) =>
                      setCompletionModal((prev) => ({
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
                  <input
                    type="time"
                    value={completionModal.pickupTime}
                    onChange={(e) =>
                      setCompletionModal((prev) => ({
                        ...prev,
                        pickupTime: e.target.value,
                      }))
                    }
                    required
                    className="w-full border border-blue-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Pickup Notes (Optional)
                </label>
                <textarea
                  value={completionModal.pickupNotes}
                  onChange={(e) =>
                    setCompletionModal((prev) => ({
                      ...prev,
                      pickupNotes: e.target.value,
                    }))
                  }
                  placeholder="Any special instructions or notes for pickup..."
                  rows={3}
                  maxLength={500}
                  className="w-full border border-blue-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <div className="text-xs text-blue-600 mt-1">
                  {completionModal.pickupNotes.length}/500 characters
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(PAYMENT_METHODS).map((method) => (
                <label
                  key={method}
                  className={`
              relative flex items-center p-4 border rounded-lg cursor-pointer transition-colors
              ${
                completionModal.paymentMethod === method
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 hover:bg-gray-50"
              }
            `}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={completionModal.paymentMethod === method}
                    onChange={(e) =>
                      setCompletionModal((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                      }))
                    }
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div
                      className={`
                  w-4 h-4 rounded-full border-2 mr-3
                  ${
                    completionModal.paymentMethod === method
                      ? "border-green-500 bg-green-500"
                      : "border-gray-300"
                  }
                `}
                    >
                      {completionModal.paymentMethod === method && (
                        <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {method === "Cash" ? "💵 Cash" : "💳 Card"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {method === "Cash" ? "Pay with cash" : "Pay with card"}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 justify-end pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() =>
                setCompletionModal({
                  isOpen: false,
                  deliveryMethod: "",
                  paymentMethod: "",
                  pickupDate: "",
                  pickupTime: "",
                  pickupNotes: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCompletionUpdate}
              loading={actionLoading}
              disabled={
                !completionModal.deliveryMethod ||
                !completionModal.paymentMethod ||
                (completionModal.deliveryMethod === "Pickup" &&
                  (!completionModal.pickupDate || !completionModal.pickupTime))
              }
            >
              {actionLoading ? "Updating..." : "Confirm Details"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        isOpen={addItemModal.isOpen}
        onClose={() =>
          setAddItemModal({
            isOpen: false,
            type: ITEM_TYPES.CUTTER,
            measurement: {
              value: "",
              unit: MEASUREMENT_UNITS.CM,
            },
            additionalComments: "",
          })
        }
        title="Add New Item"
        size="medium"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Type *
            </label>
            <select
              value={addItemModal.type}
              onChange={(e) =>
                setAddItemModal((prev) => ({ ...prev, type: e.target.value }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.values(ITEM_TYPES).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Measurement Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size *
              </label>
              <input
                type="number"
                value={addItemModal.measurement.value}
                onChange={(e) =>
                  setAddItemModal((prev) => ({
                    ...prev,
                    measurement: {
                      ...prev.measurement,
                      value: parseFloat(e.target.value) || "",
                    },
                  }))
                }
                placeholder="Enter size"
                min="0.1"
                max="1000"
                step="0.1"
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit *
              </label>
              <select
                value={addItemModal.measurement.unit}
                onChange={(e) =>
                  setAddItemModal((prev) => ({
                    ...prev,
                    measurement: {
                      ...prev.measurement,
                      unit: e.target.value,
                    },
                  }))
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(MEASUREMENT_UNITS).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Measurement Preview */}
          {addItemModal.measurement.value && (
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>📏 Size Preview:</strong>{" "}
                {addItemModal.measurement.value}
                {addItemModal.measurement.unit}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Comments
            </label>
            <textarea
              value={addItemModal.additionalComments}
              onChange={(e) =>
                setAddItemModal((prev) => ({
                  ...prev,
                  additionalComments: e.target.value,
                }))
              }
              placeholder="Describe your requirements, size, special features..."
              rows={3}
              maxLength={1000}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              {addItemModal.additionalComments.length}/1000 characters
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>📸 Note:</strong> After adding the item, you'll be able to
              upload inspiration images to help us understand your vision.
            </p>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setAddItemModal({
                  isOpen: false,
                  type: ITEM_TYPES.CUTTER,
                  measurement: {
                    value: "",
                    unit: MEASUREMENT_UNITS.CM,
                  },
                  additionalComments: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddItem}
              loading={actionLoading}
              disabled={actionLoading || !addItemModal.measurement.value}
            >
              Add Item
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Modal */}
      <Modal
        isOpen={imageModal.isOpen}
        onClose={() =>
          setImageModal({ isOpen: false, imageUrl: "", imageTitle: "" })
        }
        title={imageModal.imageTitle}
        size="xlarge"
      >
        <div className="flex justify-center">
          <img
            src={imageModal.imageUrl}
            alt={imageModal.imageTitle}
            className="max-w-full max-h-96 object-contain rounded-lg"
            style={{ maxHeight: "70vh" }}
          />
        </div>
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => window.open(imageModal.imageUrl, "_blank")}
          >
            Open Full Size
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Enhanced Edit Item Form Component with better permissions
const EditItemForm = ({ item, onSave, onCancel, canEdit = false }) => {
  const [formData, setFormData] = useState({
    type: item.type,
    measurement: {
      value: item.measurement?.value || "",
      unit: item.measurement?.unit || MEASUREMENT_UNITS.CM,
    },
    additionalComments: item.additionalComments || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!canEdit) {
      alert("You cannot edit this item in the current order stage.");
      return;
    }

    // Validate measurement
    const measurementValidation = validateMeasurement(formData.measurement);
    if (!measurementValidation.valid) {
      alert(measurementValidation.message);
      return;
    }

    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Item Type
        </label>
        <select
          value={formData.type}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, type: e.target.value }))
          }
          disabled={!canEdit}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
        >
          {Object.values(ITEM_TYPES).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Measurement Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Size *
          </label>
          <input
            type="number"
            value={formData.measurement.value}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                measurement: {
                  ...prev.measurement,
                  value: parseFloat(e.target.value) || "",
                },
              }))
            }
            placeholder="Enter size"
            min="0.1"
            max="1000"
            step="0.1"
            required
            disabled={!canEdit}
            className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit *
          </label>
          <select
            value={formData.measurement.unit}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                measurement: {
                  ...prev.measurement,
                  unit: e.target.value,
                },
              }))
            }
            disabled={!canEdit}
            className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            {Object.values(MEASUREMENT_UNITS).map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Measurement Preview */}
      {formData.measurement.value && (
        <div className="p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>📏 Size Preview:</strong> {formData.measurement.value}
            {formData.measurement.unit}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Comments
        </label>
        <textarea
          value={formData.additionalComments}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              additionalComments: e.target.value,
            }))
          }
          rows={3}
          maxLength={1000}
          disabled={!canEdit}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            !canEdit ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
        />
        <div className="text-xs text-gray-500 mt-1">
          {formData.additionalComments.length}/1000 characters
        </div>
      </div>

      {!canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-700">
            <strong>Note:</strong> Items can only be edited in Draft or
            Requested Changes stages.
          </p>
        </div>
      )}

      <div className="flex space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!canEdit || !formData.measurement.value}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
};

// Enhanced Image Gallery Component with better permissions display
const ImageGallery = ({
  images,
  onDelete,
  onImageClick,
  canDelete,
  imageType = "image",
}) => {
  if (!images || images.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No images uploaded yet</p>
    );
  }

  // Debug: Log image structure
  console.log("🖼️ ImageGallery - Images data:", {
    imageType,
    count: images.length,
    sampleImage: images[0]
      ? {
          url: images[0].url,
          key: images[0].key,
          keyLength: images[0].key?.length,
          hasKey: !!images[0].key,
        }
      : null,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {images.map((image, index) => (
        <div key={index} className="relative group">
          <img
            src={image.url}
            alt={`${imageType} ${index + 1}`}
            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onImageClick && onImageClick(image.url)}
            title="Click to view full size"
          />
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering image click
                console.log("🗑️ Delete button clicked for image:", {
                  index,
                  key: image.key,
                  url: image.url,
                  imageType,
                });
                onDelete(image.key);
              }}
              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
              title="Delete image"
            >
              ×
            </button>
          )}
          <div className="text-xs text-gray-500 mt-1 truncate">
            {new Date(image.uploadedAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderDetail;
