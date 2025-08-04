/* Inspiration Images */
// src/components/Orders/OrderDetail.js - Fixed multiple image upload
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  ORDER_STAGES,
  ITEM_TYPES,
  DELIVERY_METHODS,
  PAYMENT_METHODS,
  getStageColor,
  formatDate,
  getNextAllowedStages,
  canEditOrder,
  canDeleteOrder,
} from "../../utils/orderHelpers";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import axios from "axios";

const OrderDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

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
  const [completionModal, setCompletionModal] = useState({
    isOpen: false,
    deliveryMethod: "",
    paymentMethod: "",
  });
  const [uploadingImages, setUploadingImages] = useState({});
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    imageUrl: "",
    imageTitle: "",
  });

  useEffect(() => {
    if (id) {
      loadOrder();
    }
  }, [id]);

  const loadOrder = async () => {
    // Don't reload if upload is in progress
    if (uploadInProgressRef.current) {
      console.log("🚫 Skipping order reload - upload in progress");
      return;
    }

    try {
      setLoading(true);
      console.log("🔄 Loading order with ID:", id);
      const response = await axios.get(`/orders/${id}`);
      console.log("✅ Order loaded successfully");
      setOrder(response.data);
    } catch (error) {
      console.error("❌ Error loading order:", error);
      showError("Failed to load order details");
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

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
    const { deliveryMethod, paymentMethod } = completionModal;

    try {
      setActionLoading(true);

      await axios.put(`/orders/${id}/completion`, {
        deliveryMethod,
        paymentMethod,
      });

      showSuccess("Completion details updated successfully");
      loadOrder();
      setCompletionModal({
        isOpen: false,
        deliveryMethod: "",
        paymentMethod: "",
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

  const handleOrderDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this entire order? This action cannot be undone."
      )
    ) {
      try {
        await axios.delete(`/orders/${id}`);
        showSuccess("Order deleted successfully");
        navigate("/orders");
      } catch (error) {
        console.error("Error deleting order:", error);
        showError(error.response?.data?.message || "Failed to delete order");
      }
    }
  };

  const handleImageUpload = async (files, itemId, imageType) => {
    if (!files || files.length === 0) return;

    // Convert FileList to Array to prevent issues with component re-renders
    const fileArray = Array.from(files);

    console.log("🔍 Multiple image upload started:", {
      fileCount: fileArray.length,
      itemId,
      imageType,
      orderId: id,
      files: fileArray.map((f) => f.name),
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

      // Upload files sequentially to avoid version conflicts
      // Use a traditional for loop with explicit length check
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        console.log(
          `📤 Uploading file ${i + 1}/${fileArray.length}: ${file.name}`
        );

        try {
          const formData = new FormData();
          formData.append("image", file);

          const response = await axios.post(
            `/upload/${imageType}/${id}/${itemId}`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 30000, // 30 second timeout per file
            }
          );

          console.log(`✅ Successfully uploaded: ${file.name}`);
          successCount++;

          // Small delay to prevent overwhelming the server and allow any state updates
          if (i < fileArray.length - 1) {
            console.log(
              `💤 Waiting before next upload (${i + 2}/${fileArray.length})`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (fileError) {
          console.error(`❌ Failed to upload ${file.name}:`, fileError);
          failedFiles.push(file.name);

          // Continue with next file even if this one failed
          console.log(`⏭️ Continuing with next file after error`);
        }
      }

      console.log(
        `📊 Upload summary: ${successCount}/${fileArray.length} successful, ${failedFiles.length} failed`
      );

      // Show appropriate success/error messages
      if (successCount > 0) {
        if (successCount === fileArray.length) {
          showSuccess(
            `All ${fileArray.length} image(s) uploaded successfully!`
          );
        } else {
          showSuccess(
            `${successCount} of ${fileArray.length} image(s) uploaded successfully`
          );
          if (failedFiles.length > 0) {
            showError(`Failed to upload: ${failedFiles.join(", ")}`);
          }
        }

        // Only refresh order data after ALL uploads are complete
        console.log("🔄 Refreshing order data after all uploads complete");
        await loadOrderAfterUpload();
      } else {
        showError(
          `Failed to upload any images. ${
            failedFiles.length > 0
              ? `Failed files: ${failedFiles.join(", ")}`
              : "Unknown error occurred"
          }`
        );
      }
    } catch (error) {
      console.error("❌ Upload process failed:", error);
      showError("Failed to start upload process");
    } finally {
      // Clear upload in progress flag
      uploadInProgressRef.current = false;

      setUploadingImages((prev) => ({
        ...prev,
        [`${itemId}-${imageType}`]: false,
      }));

      console.log("🏁 Upload process completed, flags cleared");
    }
  };

  // Separate function to load order after upload completes
  const loadOrderAfterUpload = async () => {
    try {
      console.log("🔄 Loading updated order data after upload");

      // Add a small delay to ensure backend has processed the upload
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      showError("Failed to refresh order data");
    }
  };

  const handleImageDelete = async (itemId, imageKey, imageType) => {
    if (window.confirm("Are you sure you want to delete this image?")) {
      try {
        console.log("🗑️ Deleting image:", {
          itemId,
          imageKey,
          imageType,
          orderId: id,
          deleteUrl: `/upload/${imageType}/${id}/${itemId}/${encodeURIComponent(
            imageKey
          )}`,
        });

        await axios.delete(
          `/upload/${imageType}/${id}/${itemId}/${encodeURIComponent(imageKey)}`
        );
        showSuccess("Image deleted successfully");
        loadOrder();
      } catch (error) {
        console.error("Error deleting image:", error);
        console.error(
          "Delete URL attempted:",
          `/upload/${imageType}/${id}/${itemId}/${encodeURIComponent(imageKey)}`
        );
        console.error("Error details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        showError(error.response?.data?.message || "Failed to delete image");
      }
    }
  };

  const canUploadInspirationImages = () => {
    return user.role === "baker" && order.bakerId === user.bakerId;
  };

  const canUploadPreviewImages = () => {
    return user.role === "admin";
  };

  const canDeleteInspirationImages = () => {
    // Bakers can delete their own inspiration images, Admins can delete any inspiration images
    return (
      (user.role === "baker" && order.bakerId === user.bakerId) ||
      user.role === "admin"
    );
  };

  const canDeletePreviewImages = () => {
    // Only admins can delete preview images (since only admins upload them)
    return user.role === "admin";
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
                                          isCurrent
                                            ? `bg-${getStageColor(
                                                order.stage
                                              )}-600 text-white`
                                            : isCompleted
                                            ? "bg-green-600 text-white"
                                            : "bg-gray-300 text-gray-600"
                                        }
                                    `}
                  >
                    {isCompleted && !isCurrent ? "✓" : index + 1}
                  </div>
                  <div className="text-xs text-center mt-2 max-w-20">
                    {stage}
                  </div>

                  {index < Object.values(ORDER_STAGES).length - 1 && (
                    <div
                      className={`
                                            absolute top-4 left-8 w-16 h-0.5
                                            ${
                                              isCompleted
                                                ? "bg-green-600"
                                                : "bg-gray-300"
                                            }
                                        `}
                    />
                  )}
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
                  ? order.items.filter(
                      (item) =>
                        !item.inspirationImages ||
                        item.inspirationImages.length === 0
                    )
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
                      : `Move to ${stage}`}
                  </Button>
                );
              })}
            </div>

            {/* Show warning if trying to submit without images */}
            {user.role === "baker" &&
              order.stage === ORDER_STAGES.DRAFT &&
              (() => {
                const itemsWithoutImages = order.items.filter(
                  (item) =>
                    !item.inspirationImages ||
                    item.inspirationImages.length === 0
                );
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
                              {order.items.length}
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
                    })
                  }
                >
                  Set Completion Details
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
                {formatDate(order.createdAt)}
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
                {order.items.length}
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
                      {formatDate(history.changedAt)}
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
        </div>

        <div className="space-y-6">
          {order.items.map((item, index) => (
            <div
              key={item._id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-800">
                  Item {index + 1}: {item.type}
                </h4>

                {canEditOrder(order, user) && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingItem(item._id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleItemDelete(item._id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editingItem === item._id ? (
                <EditItemForm
                  item={item}
                  onSave={(updates) => handleItemUpdate(item._id, updates)}
                  onCancel={() => setEditingItem(null)}
                />
              ) : (
                <>
                  {item.additionalComments && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-1">
                        Comments:
                      </h5>
                      <p className="text-sm text-gray-600">
                        {item.additionalComments}
                      </p>
                    </div>
                  )}

                  {/* Inspiration Images */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">
                          Inspiration Images:
                        </h5>
                        {canDeleteInspirationImages() && (
                          <p className="text-xs text-gray-500 mt-1">
                            {user.role === "baker"
                              ? "You can upload and delete your inspiration images"
                              : "As admin, you can delete any inspiration images"}
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
                                count: selectedFiles ? selectedFiles.length : 0,
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
                            loading={uploadingImages[`${item._id}-inspiration`]}
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
                                count: selectedFiles ? selectedFiles.length : 0,
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
          ))}
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
          })
        }
        title="Completion Details"
        size="medium"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Method *
            </label>
            <select
              value={completionModal.deliveryMethod}
              onChange={(e) =>
                setCompletionModal((prev) => ({
                  ...prev,
                  deliveryMethod: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select delivery method</option>
              {Object.values(DELIVERY_METHODS).map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              value={completionModal.paymentMethod}
              onChange={(e) =>
                setCompletionModal((prev) => ({
                  ...prev,
                  paymentMethod: e.target.value,
                }))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select payment method</option>
              {Object.values(PAYMENT_METHODS).map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3 justify-end">
            <Button
              variant="outline"
              onClick={() =>
                setCompletionModal({
                  isOpen: false,
                  deliveryMethod: "",
                  paymentMethod: "",
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
                !completionModal.paymentMethod
              }
            >
              Update Details
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image View Modal */}
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

// Edit Item Form Component
const EditItemForm = ({ item, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    type: item.type,
    additionalComments: item.additionalComments,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
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
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.values(ITEM_TYPES).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

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
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save Changes
        </Button>
      </div>
    </form>
  );
};

// Image Gallery Component
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
