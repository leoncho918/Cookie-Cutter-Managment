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
import PickupDetails from "./PickupDetails";
import axios from "axios";
import CompletionModal from "./CompletionModal";
import UpdateRequestModal from "./UpdateRequestModal"; // Add this line
import { validatePostcode } from "../../utils/countryHelpers";

// Add this component before the main OrderDetail component
const STLFileGallery = ({ stlFiles, onDelete, canDelete }) => {
  if (!stlFiles || stlFiles.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No STL file uploaded yet</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {stlFiles.map((stlFile, index) => (
        <div
          key={stlFile.key || index}
          className="border border-gray-200 rounded-lg p-3 bg-gray-50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {stlFile.originalName || `STL File ${index + 1}`}
                </p>
                <p className="text-xs text-gray-500">
                  Uploaded {formatDate(stlFile.uploadedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href={stlFile.url}
                download={stlFile.originalName}
                className="text-blue-600 hover:text-blue-800 text-sm
                font-medium"
              >
                Download
              </a>
              {canDelete && (
                <button
                  onClick={() => onDelete(stlFile.key)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

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
    deliveryAddress: {
      street: "",
      suburb: "",
      state: "",
      postcode: "",
      country: "Australia",
      instructions: "",
    },
  });
  const [showPickupDetails, setShowPickupDetails] = useState(false);
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
  const [updateRequestModal, setUpdateRequestModal] = useState({
    isOpen: false,
    reason: "",
  });
  // NEW: Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
  });
  // Add this new state variable
  const [dismissedUpdateRequest, setDismissedUpdateRequest] = useState(false);

  const [uploadingSTL, setUploadingSTL] = useState({});

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
            case "update_requested":
              if (user.role === "admin") {
                message = `Update request for order ${updatedOrder.orderNumber} from ${updatedBy.email}`;
              }
              break;
            case "update_request_approved":
              message = `Update request approved for order ${updatedOrder.orderNumber}`;
              break;
            case "update_request_rejected":
              message = `Update request rejected for order ${updatedOrder.orderNumber}`;
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

  // Reset dismissed state when order changes or update request status changes
  useEffect(() => {
    if (
      order &&
      order.updateRequest &&
      order.updateRequest.status === "rejected"
    ) {
      const storedDismissal = localStorage.getItem(
        `dismissed_update_request_${id}`
      );
      if (storedDismissal === order.updateRequest.requestedAt) {
        setDismissedUpdateRequest(true);
      }
    }
  }, [order, id]);

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
      deliveryAddress,
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

    // If delivery is selected, validate delivery address
    if (deliveryMethod === "Delivery") {
      if (
        !deliveryAddress.street ||
        !deliveryAddress.suburb ||
        !deliveryAddress.state ||
        !deliveryAddress.postcode ||
        !deliveryAddress.country
      ) {
        showError(
          "Please provide a complete delivery address including country"
        );
        return;
      }

      // Validate postcode format for the selected country
      const postcodeValidation = validatePostcode(
        deliveryAddress.postcode,
        deliveryAddress.country
      );
      if (!postcodeValidation.valid) {
        showError(postcodeValidation.message);
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

      // Add delivery address if delivery is selected
      if (deliveryMethod === "Delivery") {
        payload.deliveryAddress = {
          street: deliveryAddress.street.trim(),
          suburb: deliveryAddress.suburb.trim(),
          state: deliveryAddress.state.trim(),
          postcode: deliveryAddress.postcode.trim(),
          country: deliveryAddress.country || "Australia",
          instructions: deliveryAddress.instructions
            ? deliveryAddress.instructions.trim()
            : "",
        };
      }

      const response = await axios.put(`/orders/${id}/completion`, payload);

      showSuccess("Completion details updated successfully");
      loadOrder();
      setCompletionModal({
        isOpen: false,
        deliveryMethod: "",
        paymentMethod: "",
        pickupDate: "",
        pickupTime: "",
        pickupNotes: "",
        deliveryAddress: {
          street: "",
          suburb: "",
          state: "",
          postcode: "",
          country: "Australia",
          instructions: "",
        },
      });

      // NEW: Show confirmation modal if baker needs to confirm
      if (response.data.requiresConfirmation) {
        setConfirmationModal({
          isOpen: true,
        });
      }
    } catch (error) {
      console.error("Error updating completion details:", error);
      showError(
        error.response?.data?.message || "Failed to update completion details"
      );
    } finally {
      setActionLoading(false);
    }
  };

  // NEW: Handle details confirmation
  const handleDetailsConfirmation = async () => {
    try {
      setActionLoading(true);

      await axios.put(`/orders/${id}/completion/confirm`);

      showSuccess("Collection and payment details confirmed successfully!");
      showInfo("Details are now locked. Contact admin if changes are needed.");
      loadOrder();

      setConfirmationModal({
        isOpen: false,
      });
    } catch (error) {
      console.error("Error confirming completion details:", error);
      showError(
        error.response?.data?.message || "Failed to confirm completion details"
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

    // Only validate measurement for non-STL items
    if (type !== "STL") {
      const measurementValidation = validateMeasurement(measurement);
      if (!measurementValidation.valid) {
        showError(measurementValidation.message);
        return;
      }
    }

    try {
      setActionLoading(true);

      const itemData = {
        type,
        additionalComments,
      };

      // Only include measurement for non-STL items
      if (type !== "STL") {
        itemData.measurement = measurement;
      }

      await axios.post(`/orders/${id}/items`, itemData);

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

  // Add this new function forr STL file uploads
  const handleSTLUpload = async (files, itemId) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    console.log("🔍 STL upload started:", {
      fileCount: fileArray.length,
      itemId,
      orderId: id,
    });

    try {
      setUploadingSTL((prev) => ({
        ...prev,
        [itemId]: true,
      }));

      let successCount = 0;
      let failedFiles = [];

      if (fileArray.length > 1) {
        showInfo(`Uploading ${fileArray.length} STL file(s)...`);
      }

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        // Validate STL file
        if (!file.name.toLowerCase().endsWith(".stl")) {
          failedFiles.push(`${file.name} (not an STL file)`);
          continue;
        }

        console.log(
          `📤 Uploading STL ${i + 1}/${fileArray.length}: ${file.name}`
        );

        try {
          const formData = new FormData();
          formData.append("stlFile", file);

          const response = await axios.post(
            `/upload/stl/${id}/${itemId}`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 60000, // Longer timeout for STL files
            }
          );

          console.log(
            `✅ STL upload response for ${file.name}:`,
            response.data
          );
          successCount++;

          if (fileArray.length > 1) {
            showInfo(`Uploaded ${successCount}/${fileArray.length} STL files`);
          }
        } catch (fileError) {
          console.error(`❌ Failed to upload STL ${file.name}:`, fileError);
          failedFiles.push(file.name);
        }

        if (i < fileArray.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Final success/error messages
      if (successCount > 0) {
        const message =
          successCount === fileArray.length
            ? fileArray.length === 1
              ? "STL file uploaded successfully!"
              : `All ${fileArray.length} STL files uploaded successfully!`
            : `${successCount}/${fileArray.length} STL files uploaded successfully`;

        showSuccess(message);
        loadOrder(); // Reload to show new files
      }

      if (failedFiles.length > 0) {
        showError(`Failed to upload: ${failedFiles.join(", ")}`);
      }
    } catch (error) {
      console.error("❌ STL upload error:", error);
      showError("Failed to upload STL files");
    } finally {
      setUploadingSTL((prev) => ({
        ...prev,
        [itemId]: false,
      }));
    }
  };

  // Add this new function after handleSTLUpload
  const handleDeleteSTL = async (itemId, stlKey) => {
    if (!window.confirm("Are you sure you want to delete this STL file?")) {
      return;
    }

    try {
      await axios.post("/upload/delete", {
        orderId: id,
        itemId: itemId,
        imageKey: stlKey, // Reuse existing delete endpoint
        imageType: "stl", // New type for STL files
      });

      showSuccess("STL file deleted successfully");
      loadOrder();
    } catch (error) {
      console.error("Error deleting STL file:", error);
      showError(error.response?.data?.message || "Failed to delete STL file");
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

  const handleOpenCompletionModal = () => {
    setCompletionModal({
      isOpen: true,
      deliveryMethod: order.deliveryMethod || "",
      paymentMethod: order.paymentMethod || "",
      pickupDate: order.pickupSchedule?.date
        ? formatDateForInput(order.pickupSchedule.date)
        : "",
      pickupTime: order.pickupSchedule?.time || "",
      pickupNotes: order.pickupSchedule?.notes || "",
      deliveryAddress: {
        street: order.deliveryAddress?.street || "",
        suburb: order.deliveryAddress?.suburb || "",
        state: order.deliveryAddress?.state || "",
        postcode: order.deliveryAddress?.postcode || "",
        country: order.deliveryAddress?.country || "Australia",
        instructions: order.deliveryAddress?.instructions || "",
      },
    });
  };

  // NEW: Handle opening confirmation modal
  const handleOpenConfirmationModal = () => {
    setConfirmationModal({
      isOpen: true,
    });
  };

  const renderCompletionDetails = () => {
    if (order.stage !== ORDER_STAGES.COMPLETED) return null;

    // IMPORTANT: Ensure both Bakers and Admins can see completion details
    // Only the Baker who owns the order and Admins should see this section
    if (user.role === "baker" && order.bakerId !== user.bakerId) {
      return null; // Baker can only see their own order's completion details
    }

    const isInternationalDelivery =
      order.deliveryMethod === "Delivery" &&
      order.deliveryAddress?.country &&
      order.deliveryAddress.country !== "Australia";

    return (
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Collection & Payment Details
          {isInternationalDelivery && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              🌍 International
            </span>
          )}
          {/* Confirmation status indicator */}
          {order.detailsConfirmed && (
            <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              ✅ Confirmed
            </span>
          )}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {order.deliveryMethod === "Pickup" ? "🚶" : "🚚"}
            </span>
            <div>
              <div className="text-sm font-medium text-gray-700">
                Collection Method:
              </div>
              <div className="text-sm text-gray-900">
                {order.deliveryMethod || "Not specified"}
                {isInternationalDelivery && (
                  <span className="text-blue-600 ml-1">(International)</span>
                )}
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

        {/* Pickup Schedule Details */}
        {order.deliveryMethod === "Pickup" && order.pickupSchedule && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-blue-600 text-lg mr-3">📅</span>
              <div>
                <div className="text-sm font-medium text-blue-800">
                  Scheduled Pickup:
                </div>
                <div className="text-sm text-blue-900">
                  {new Date(order.pickupSchedule.date).toLocaleDateString(
                    "en-AU"
                  )}{" "}
                  at {order.pickupSchedule.time}
                  {order.pickupSchedule.notes && (
                    <div className="text-xs text-blue-700 mt-1">
                      Notes: {order.pickupSchedule.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Address Details */}
        {order.deliveryMethod === "Delivery" && order.deliveryAddress && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-green-600 text-lg mr-3">🏠</span>
              <div>
                <div className="text-sm font-medium text-green-800">
                  Delivery Address:
                </div>
                <div className="text-sm text-green-900">
                  <div>{order.deliveryAddress.street}</div>
                  <div>
                    {order.deliveryAddress.suburb} {order.deliveryAddress.state}{" "}
                    {order.deliveryAddress.postcode}
                  </div>
                  <div>{order.deliveryAddress.country}</div>
                  {order.deliveryAddress.instructions && (
                    <div className="text-xs text-green-700 mt-1">
                      Instructions: {order.deliveryAddress.instructions}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CRITICAL FIX: Action Buttons Section */}
        <div className="flex justify-between items-center">
          <div>
            {order.detailsConfirmed ? (
              <div className="text-green-600 text-sm flex items-center mt-4">
                <span className="text-green-500 mr-2">✅</span>
                Details confirmed on{" "}
                {new Date(order.detailsConfirmedAt).toLocaleDateString("en-AU")}
              </div>
            ) : (
              <div className="text-gray-600 text-sm mt-4">
                Details need to be confirmed once finalized
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 mt-4">
            {/* Show update request status indicators */}
            {order.updateRequest &&
              order.updateRequest.status &&
              order.updateRequest.requestedBy &&
              order.updateRequest.requestedAt &&
              order.stage === "Completed" &&
              order.updateRequest.status === "pending" && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  Update Request Pending
                </span>
              )}
            {order.updateRequest &&
              order.updateRequest.status &&
              order.updateRequest.requestedBy &&
              order.updateRequest.requestedAt &&
              order.stage === "Completed" &&
              order.updateRequest.status === "rejected" && (
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                  Update Request Rejected
                </span>
              )}

            {order.stage === "Completed" && order.detailsConfirmed ? (
              // Details are confirmed - show request update button (only for completed orders)
              <Button
                variant="outline"
                size="small"
                onClick={handleOpenUpdateRequestModal}
                disabled={
                  order.updateRequest &&
                  order.updateRequest.status &&
                  order.updateRequest.requestedBy &&
                  order.updateRequest.requestedAt &&
                  order.updateRequest.status === "pending"
                }
                className="text-xs"
              >
                {order.updateRequest &&
                order.updateRequest.status &&
                order.updateRequest.requestedBy &&
                order.updateRequest.requestedAt &&
                order.updateRequest.status === "pending"
                  ? "Request Pending..."
                  : "📧 Request to Update Details"}
              </Button>
            ) : order.stage === "Completed" &&
              order.updateRequest &&
              order.updateRequest.status &&
              order.updateRequest.requestedBy &&
              order.updateRequest.requestedAt &&
              order.updateRequest.status === "approved" ? (
              // Update request approved - show edit button with special styling
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCompletionModal}
                className="bg-green-600 hover:bg-green-700"
              >
                Update Details
              </Button>
            ) : order.stage === "Completed" &&
              (!order.deliveryMethod || !order.paymentMethod) ? (
              // No details set yet - keep existing button (only for completed orders)
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenCompletionModal}
              >
                Set Collection & Payment Details
              </Button>
            ) : order.stage === "Completed" ? (
              // Details are set but not confirmed - keep existing buttons (only for completed orders)
              <>
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenConfirmationModal}
                >
                  Confirm Details
                </Button>
                <Button
                  variant="outline"
                  size="small"
                  onClick={handleOpenCompletionModal}
                >
                  Edit Details
                </Button>
              </>
            ) : null}
          </div>
        </div>
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

  const handleOpenUpdateRequestModal = () => {
    setUpdateRequestModal({
      isOpen: true,
      reason: "",
    });
  };

  const handleUpdateRequest = async () => {
    try {
      setActionLoading(true);

      if (!updateRequestModal.reason.trim()) {
        showError("Please provide a reason for the update request");
        return;
      }

      await axios.post(`/orders/${id}/request-completion-update`, {
        reason: updateRequestModal.reason,
      });

      showSuccess("Update request sent to admin successfully");
      loadOrder();
      setUpdateRequestModal({
        isOpen: false,
        reason: "",
      });
    } catch (error) {
      console.error("Error sending update request:", error);
      showError(
        error.response?.data?.message || "Failed to send update request"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRequestResponse = async (
    orderId,
    action,
    adminResponse
  ) => {
    try {
      setActionLoading(true);

      await axios.put(`/orders/${orderId}/update-request/${action}`, {
        adminResponse: adminResponse || "",
      });

      showSuccess(`Update request ${action}d successfully`);
      loadOrder();
    } catch (error) {
      console.error("Error responding to update request:", error);
      showError(
        error.response?.data?.message || "Failed to respond to update request"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderAdminUpdateRequestSection = () => {
    if (
      user.role !== "admin" ||
      !order.updateRequest ||
      !order.updateRequest.status ||
      !order.updateRequest.requestedBy ||
      !order.updateRequest.requestedAt ||
      order.stage !== "Completed" ||
      order.updateRequest.status !== "pending"
    ) {
      return null;
    }

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-yellow-800 mb-2">
              🔔 Pending Update Request
            </h3>
            <div className="space-y-2 text-sm text-yellow-700">
              <div>
                <span className="font-medium">Requested by:</span>{" "}
                {order.bakerEmail}
              </div>
              <div>
                <span className="font-medium">Requested on:</span>{" "}
                {formatDate(order.updateRequest.requestedAt)}
              </div>
              <div>
                <span className="font-medium">Reason:</span>{" "}
                {order.updateRequest.reason}
              </div>
            </div>
          </div>

          <div className="flex space-x-2 ml-4">
            <Button
              variant="primary"
              size="small"
              onClick={() => {
                const adminResponse = window.prompt(
                  "Optional: Add a note for the baker (or leave empty):"
                );
                if (adminResponse !== null) {
                  handleUpdateRequestResponse(
                    order._id,
                    "approve",
                    adminResponse
                  );
                }
              }}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              ✅ Approve Request
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={() => {
                const adminResponse = window.prompt(
                  "Please provide a reason for rejecting this request:"
                );
                if (adminResponse && adminResponse.trim()) {
                  handleUpdateRequestResponse(
                    order._id,
                    "reject",
                    adminResponse
                  );
                } else if (adminResponse !== null) {
                  showError("A reason is required when rejecting a request");
                }
              }}
              disabled={actionLoading}
            >
              ❌ Reject Request
            </Button>
          </div>
        </div>
      </div>
    );
  };

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

      {renderAdminUpdateRequestSection()}

      {order.updateRequest &&
        order.updateRequest.status &&
        order.updateRequest.requestedBy &&
        order.updateRequest.requestedAt &&
        order.stage === "Completed" &&
        order.updateRequest.status === "rejected" &&
        !dismissedUpdateRequest && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start">
                <span className="text-red-600 text-lg mr-3">❌</span>
                <div>
                  <h3 className="text-lg font-medium text-red-800 mb-2">
                    Update Request Rejected
                  </h3>
                  <div className="text-red-700 text-sm">
                    <div className="font-medium mb-1">
                      Your request to update collection and payment details was
                      rejected.
                    </div>
                    {order.updateRequest.adminResponse && (
                      <div>
                        <span className="font-medium">Reason:</span>{" "}
                        {order.updateRequest.adminResponse}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setDismissedUpdateRequest(true);
                  // Optionally persist the dismissal to localStorage
                  localStorage.setItem(
                    `dismissed_update_request_${id}`,
                    order.updateRequest.requestedAt
                  );
                }}
                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-colors duration-200"
                title="Dismiss notification"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

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
                                          order.stage !== ORDER_STAGES.DELIVERED
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
        {renderCompletionDetails()}
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
                          {item.type === "STL" ? "Type:" : "Measurement:"}
                        </h5>
                        {item.type !== "STL" && item.measurement && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Size:</span>{" "}
                            {formatMeasurement(item.measurement)}
                          </p>
                        )}
                        {item.type === "STL" && (
                          <p className="text-sm text-green-600 font-medium">
                            📁 STL File - Upload a STL file directly
                          </p>
                        )}
                        {item.type !== "STL" && !item.measurement && (
                          <p className="text-sm text-gray-500 italic">
                            Not specified
                          </p>
                        )}
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

                    {/* STL Files Section - Only for STL type items */}
                    {item.type === "STL" && (
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">
                            STL File
                          </h4>
                          {canUploadInspirationImages() && (
                            <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
                              {uploadingSTL[item._id]
                                ? "Uploading..."
                                : "Upload STL"}
                              <input
                                type="file"
                                accept=".stl"
                                multiple
                                className="hidden"
                                disabled={uploadingSTL[item._id]}
                                onChange={(e) =>
                                  handleSTLUpload(e.target.files, item._id)
                                }
                              />
                            </label>
                          )}
                        </div>

                        {uploadingSTL[item._id] && (
                          <div className="mb-3 p-2 bg-blue-50 rounded-md">
                            <p className="text-sm text-blue-700">
                              Uploading STL files...
                            </p>
                          </div>
                        )}

                        <STLFileGallery
                          stlFiles={item.stlFiles || []}
                          onDelete={(stlKey) =>
                            handleDeleteSTL(item._id, stlKey)
                          }
                          canDelete={canDeleteInspirationImages()}
                        />
                      </div>
                    )}

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

      {/* Enhanced Completion Modal - Using Separate Component */}
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

      {/* NEW: Confirmation Modal */}
      <CompletionModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ isOpen: false })}
        onConfirm={handleDetailsConfirmation}
        loading={actionLoading}
        completionData={{
          deliveryMethod: order?.deliveryMethod,
          paymentMethod: order?.paymentMethod,
          pickupDate: order?.pickupSchedule?.date,
          pickupTime: order?.pickupSchedule?.time,
          pickupNotes: order?.pickupSchedule?.notes,
          deliveryAddress: order?.deliveryAddress,
        }}
        setCompletionData={() => {}} // Read-only in confirmation step
        order={order}
        isConfirmationStep={true}
      />

      {/* Update Request Modal */}
      <UpdateRequestModal
        isOpen={updateRequestModal.isOpen}
        onClose={() =>
          setUpdateRequestModal({
            isOpen: false,
            reason: "",
          })
        }
        onSubmit={handleUpdateRequest}
        loading={actionLoading}
        updateRequestData={updateRequestModal}
        setUpdateRequestData={setUpdateRequestModal}
        order={order}
      />

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

          {/* Only show measurement fields for non-STL items */}
          {addItemModal.type !== "STL" && (
            <>
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
            </>
          )}

          {/* Show STL-specific message */}
          {addItemModal.type === "STL" && (
            <div className="p-3 bg-green-50 rounded-md">
              <p className="text-sm text-green-700">
                <strong>📁 STL File Selected:</strong> You'll be able to upload
                a STL file instead of providing measurements and an inspiration
                photo photos. No size measurement is required.
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
              <strong>{addItemModal.type === "STL" ? "📁" : "📸"} Note:</strong>{" "}
              {addItemModal.type === "STL"
                ? "After adding this STL item, you'll be able to upload STL files directly. No inspiration images or measurements are needed."
                : "After adding the item, you'll be able to upload inspiration images to help us understand your vision."}
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
              disabled={
                actionLoading ||
                (addItemModal.type !== "STL" && !addItemModal.measurement.value)
              }
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
