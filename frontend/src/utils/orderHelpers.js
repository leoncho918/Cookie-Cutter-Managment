// src/utils/orderHelpers.js - Enhanced Order utility functions with baker editing support
export const ORDER_STAGES = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  REQUIRES_APPROVAL: "Requires Approval",
  REQUESTED_CHANGES: "Requested Changes",
  READY_TO_PRINT: "Ready to Print",
  PRINTING: "Printing",
  COMPLETED: "Completed",
};

export const ITEM_TYPES = {
  CUTTER: "Cutter",
  STAMP: "Stamp",
  STAMP_AND_CUTTER: "Stamp & Cutter",
};

export const MEASUREMENT_UNITS = {
  CM: "cm",
  MM: "mm",
};

export const DELIVERY_METHODS = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
};

export const PAYMENT_METHODS = {
  CASH: "Cash",
  CARD: "Card",
};

// Enhanced: Check if baker can edit order (Draft or Requested Changes stages)
export const canBakerEditOrder = (order, user) => {
  return (
    user.role === "baker" &&
    order.bakerId === user.bakerId &&
    (order.stage === ORDER_STAGES.DRAFT ||
      order.stage === ORDER_STAGES.REQUESTED_CHANGES)
  );
};

// Enhanced: Check if user can edit order
export const canEditOrder = (order, user) => {
  if (user.role === "admin") return true;
  return canBakerEditOrder(order, user);
};

// Enhanced: Check if user can delete order
export const canDeleteOrder = (order, user) => {
  if (user.role === "admin") return true;
  return canBakerEditOrder(order, user);
};

// Enhanced: Check if user can add items
export const canAddItems = (order, user) => {
  return canEditOrder(order, user);
};

// Enhanced: Check if user can edit items
export const canEditItems = (order, user) => {
  return canEditOrder(order, user);
};

// Enhanced: Check if user can delete items
export const canDeleteItems = (order, user) => {
  return canEditOrder(order, user);
};

// Enhanced: Check if user can upload inspiration images
export const canUploadInspirationImages = (order, user) => {
  if (user.role === "admin") return true;
  return canBakerEditOrder(order, user);
};

// Enhanced: Check if user can delete inspiration images
export const canDeleteInspirationImages = (order, user) => {
  if (user.role === "admin") return true;
  return canBakerEditOrder(order, user);
};

// Check if user can upload preview images (Admin only)
export const canUploadPreviewImages = (user) => {
  return user.role === "admin";
};

// Check if user can delete preview images (Admin only)
export const canDeletePreviewImages = (user) => {
  return user.role === "admin";
};

// Get the next allowed stages for a given current stage and user role
export const getNextAllowedStages = (currentStage, userRole) => {
  if (userRole === "admin") {
    // Admins can move to most stages with some restrictions
    const adminTransitions = {
      [ORDER_STAGES.DRAFT]: [ORDER_STAGES.SUBMITTED, ORDER_STAGES.UNDER_REVIEW],
      [ORDER_STAGES.SUBMITTED]: [ORDER_STAGES.UNDER_REVIEW, ORDER_STAGES.DRAFT], // Can send back to draft
      [ORDER_STAGES.UNDER_REVIEW]: [
        ORDER_STAGES.REQUIRES_APPROVAL,
        ORDER_STAGES.SUBMITTED,
      ], // Can go back
      [ORDER_STAGES.REQUIRES_APPROVAL]: [
        ORDER_STAGES.READY_TO_PRINT,
        ORDER_STAGES.UNDER_REVIEW,
      ], // Can override baker approval
      [ORDER_STAGES.REQUESTED_CHANGES]: [
        ORDER_STAGES.UNDER_REVIEW,
        ORDER_STAGES.REQUIRES_APPROVAL,
      ],
      [ORDER_STAGES.READY_TO_PRINT]: [
        ORDER_STAGES.PRINTING,
        ORDER_STAGES.REQUIRES_APPROVAL,
      ], // Can send back for re-approval
      [ORDER_STAGES.PRINTING]: [
        ORDER_STAGES.COMPLETED,
        ORDER_STAGES.READY_TO_PRINT,
      ], // Can go back if needed
      [ORDER_STAGES.COMPLETED]: [ORDER_STAGES.PRINTING], // Can reopen if needed
    };
    return adminTransitions[currentStage] || [];
  } else if (userRole === "baker") {
    // Bakers have limited transitions
    const bakerTransitions = {
      [ORDER_STAGES.DRAFT]: [ORDER_STAGES.SUBMITTED],
      [ORDER_STAGES.SUBMITTED]: [], // Only admin can move from submitted
      [ORDER_STAGES.UNDER_REVIEW]: [], // Only admin can move from under review
      [ORDER_STAGES.REQUIRES_APPROVAL]: [
        ORDER_STAGES.READY_TO_PRINT,
        ORDER_STAGES.REQUESTED_CHANGES,
      ], // Baker approves or requests changes
      [ORDER_STAGES.REQUESTED_CHANGES]: [ORDER_STAGES.SUBMITTED], // Wait for admin to make changes
      [ORDER_STAGES.READY_TO_PRINT]: [], // Only admin can move to printing
      [ORDER_STAGES.PRINTING]: [], // Only admin can mark as completed
      [ORDER_STAGES.COMPLETED]: [], // Final stage
    };
    return bakerTransitions[currentStage] || [];
  }

  return [];
};

// Get stage color for UI styling
export const getStageColor = (stage) => {
  const colors = {
    [ORDER_STAGES.DRAFT]: "gray",
    [ORDER_STAGES.SUBMITTED]: "blue",
    [ORDER_STAGES.UNDER_REVIEW]: "yellow",
    [ORDER_STAGES.REQUIRES_APPROVAL]: "purple",
    [ORDER_STAGES.REQUESTED_CHANGES]: "orange",
    [ORDER_STAGES.READY_TO_PRINT]: "indigo",
    [ORDER_STAGES.PRINTING]: "pink",
    [ORDER_STAGES.COMPLETED]: "green",
  };

  return colors[stage] || "gray";
};

// Enhanced: Get stage description for user understanding
export const getStageDescription = (stage, userRole) => {
  const descriptions = {
    [ORDER_STAGES.DRAFT]: {
      baker:
        "You can edit items, upload images, and make changes to your order.",
      admin: "Baker is still working on their order. They can make changes.",
    },
    [ORDER_STAGES.SUBMITTED]: {
      baker: "Your order has been submitted and is waiting for admin review.",
      admin: "Baker has submitted their order for review.",
    },
    [ORDER_STAGES.UNDER_REVIEW]: {
      baker: "Admin is reviewing your order details and requirements.",
      admin: "Review the order details and set pricing for baker approval.",
    },
    [ORDER_STAGES.REQUIRES_APPROVAL]: {
      baker: "Please review the pricing and approve or request changes.",
      admin: "Waiting for baker to approve the pricing and details.",
    },
    [ORDER_STAGES.REQUESTED_CHANGES]: {
      baker: "You can edit items and upload images based on admin feedback.",
      admin: "Baker can make changes based on your feedback.",
    },
    [ORDER_STAGES.READY_TO_PRINT]: {
      baker: "Your order has been approved and is ready for production.",
      admin: "Order is approved and ready to start printing.",
    },
    [ORDER_STAGES.PRINTING]: {
      baker: "Your order is currently being printed.",
      admin: "Order is in production. Move to completed when finished.",
    },
    [ORDER_STAGES.COMPLETED]: {
      baker: "Your order is complete! Set delivery and payment details.",
      admin: "Order is completed and ready for pickup/delivery.",
    },
  };

  return descriptions[stage]?.[userRole] || "Order status information";
};

// Enhanced: Get available actions for current stage and user
export const getAvailableActions = (order, user) => {
  const actions = [];

  // Editing actions
  if (canEditOrder(order, user)) {
    actions.push({
      type: "edit",
      label: "Edit Order Details",
      description: "Modify order date, items, and comments",
      available: true,
    });
  }

  // Item management actions
  if (canAddItems(order, user)) {
    actions.push({
      type: "add_item",
      label: "Add Item",
      description: "Add new cookie cutter or stamp to this order",
      available: true,
    });
  }

  if (canEditItems(order, user)) {
    actions.push({
      type: "edit_items",
      label: "Edit Items",
      description: "Modify item properties and measurements",
      available: true,
    });
  }

  // Image management actions
  if (canUploadInspirationImages(order, user)) {
    actions.push({
      type: "upload_inspiration",
      label: "Upload Inspiration Images",
      description: "Add reference images to help us understand your vision",
      available: true,
    });
  }

  if (canUploadPreviewImages(user)) {
    actions.push({
      type: "upload_preview",
      label: "Upload Preview Images",
      description: "Add preview images of the designed items",
      available: true,
    });
  }

  // Stage transition actions
  const nextStages = getNextAllowedStages(order.stage, user.role);
  nextStages.forEach((stage) => {
    actions.push({
      type: "stage_transition",
      label: `Move to ${stage}`,
      description: getStageDescription(stage, user.role),
      targetStage: stage,
      available: true,
    });
  });

  // Deletion actions
  if (canDeleteOrder(order, user)) {
    actions.push({
      type: "delete_order",
      label: "Delete Order",
      description: "Permanently delete this entire order",
      available: true,
      destructive: true,
    });
  }

  return actions;
};

// Format date for display
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Format date and time for display
export const formatDateTime = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Format measurement for display
export const formatMeasurement = (measurement) => {
  if (!measurement || !measurement.value || measurement.value === "") {
    return "Not specified";
  }

  return `${measurement.value}${measurement.unit || "cm"}`;
};

// Validate measurement input
export const validateMeasurement = (measurement) => {
  if (!measurement) {
    return { valid: false, message: "Measurement is required" };
  }

  if (!measurement.value || measurement.value <= 0) {
    return {
      valid: false,
      message: "Measurement value must be greater than 0",
    };
  }

  if (measurement.value > 1000) {
    return { valid: false, message: "Measurement value cannot exceed 1000" };
  }

  if (
    !measurement.unit ||
    !Object.values(MEASUREMENT_UNITS).includes(measurement.unit)
  ) {
    return { valid: false, message: "Valid measurement unit is required" };
  }

  return { valid: true };
};

// Convert measurements between units
export const convertMeasurement = (value, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return value;

  if (fromUnit === MEASUREMENT_UNITS.CM && toUnit === MEASUREMENT_UNITS.MM) {
    return value * 10;
  }

  if (fromUnit === MEASUREMENT_UNITS.MM && toUnit === MEASUREMENT_UNITS.CM) {
    return value / 10;
  }

  return value;
};

// Enhanced: Get editing restrictions message
export const getEditingRestrictionsMessage = (order, user) => {
  if (user.role === "admin") {
    return null; // Admins can always edit
  }

  if (user.role === "baker") {
    if (order.bakerId !== user.bakerId) {
      return "You can only edit your own orders.";
    }

    if (
      order.stage === ORDER_STAGES.DRAFT ||
      order.stage === ORDER_STAGES.REQUESTED_CHANGES
    ) {
      return null; // Baker can edit in these stages
    }

    return `You can only edit orders in Draft or Requested Changes stages. Current stage: ${order.stage}`;
  }

  return "You do not have permission to edit this order.";
};

// Enhanced: Get image management permissions info
export const getImagePermissions = (order, user) => {
  return {
    canUploadInspiration: canUploadInspirationImages(order, user),
    canDeleteInspiration: canDeleteInspirationImages(order, user),
    canUploadPreview: canUploadPreviewImages(user),
    canDeletePreview: canDeletePreviewImages(user),
    inspirationMessage:
      user.role === "baker"
        ? canBakerEditOrder(order, user)
          ? "You can upload and delete inspiration images in this stage"
          : "You can only manage inspiration images in Draft or Requested Changes stages"
        : "As admin, you can manage inspiration images at any time",
    previewMessage:
      user.role === "admin"
        ? "You can upload and delete preview images"
        : "Only admins can manage preview images",
  };
};

// Enhanced: Check if order has required images for submission
export const hasRequiredImagesForSubmission = (order) => {
  return order.items.every(
    (item) => item.inspirationImages && item.inspirationImages.length > 0
  );
};

// Enhanced: Get submission validation
export const validateOrderForSubmission = (order) => {
  const validation = { valid: true, issues: [] };

  // Check for inspiration images
  const itemsWithoutImages = order.items.filter(
    (item) => !item.inspirationImages || item.inspirationImages.length === 0
  );

  if (itemsWithoutImages.length > 0) {
    validation.valid = false;
    validation.issues.push({
      type: "missing_images",
      message: `${itemsWithoutImages.length} item(s) are missing inspiration images`,
      details: `Please upload at least one inspiration image for each item before submitting.`,
      count: itemsWithoutImages.length,
      total: order.items.length,
    });
  }

  // Check for items
  if (!order.items || order.items.length === 0) {
    validation.valid = false;
    validation.issues.push({
      type: "no_items",
      message: "Order must have at least one item",
      details: "Please add items to your order before submitting.",
    });
  }

  // Check for measurements
  const itemsWithoutMeasurements = order.items.filter(
    (item) =>
      !item.measurement ||
      !item.measurement.value ||
      item.measurement.value <= 0
  );

  if (itemsWithoutMeasurements.length > 0) {
    validation.valid = false;
    validation.issues.push({
      type: "missing_measurements",
      message: `${itemsWithoutMeasurements.length} item(s) are missing valid measurements`,
      details: "All items must have valid measurements before submitting.",
    });
  }

  return validation;
};

// Enhanced: Get user-friendly stage transition labels
export const getStageTransitionLabel = (fromStage, toStage, userRole) => {
  const transitions = {
    [`${ORDER_STAGES.DRAFT}-${ORDER_STAGES.SUBMITTED}`]: "Submit Order",
    [`${ORDER_STAGES.SUBMITTED}-${ORDER_STAGES.UNDER_REVIEW}`]: "Start Review",
    [`${ORDER_STAGES.UNDER_REVIEW}-${ORDER_STAGES.REQUIRES_APPROVAL}`]:
      "Set Price & Request Approval",
    [`${ORDER_STAGES.UNDER_REVIEW}-${ORDER_STAGES.REQUESTED_CHANGES}`]:
      "Request Changes",
    [`${ORDER_STAGES.REQUIRES_APPROVAL}-${ORDER_STAGES.READY_TO_PRINT}`]:
      "Approve Order",
    [`${ORDER_STAGES.REQUIRES_APPROVAL}-${ORDER_STAGES.REQUESTED_CHANGES}`]:
      "Request Changes",
    [`${ORDER_STAGES.REQUESTED_CHANGES}-${ORDER_STAGES.UNDER_REVIEW}`]:
      "Resubmit for Review",
    [`${ORDER_STAGES.READY_TO_PRINT}-${ORDER_STAGES.PRINTING}`]:
      "Start Printing",
    [`${ORDER_STAGES.PRINTING}-${ORDER_STAGES.COMPLETED}`]: "Mark Complete",
  };

  const key = `${fromStage}-${toStage}`;
  return transitions[key] || `Move to ${toStage}`;
};

// Enhanced: Get comprehensive order permissions
export const getOrderPermissions = (order, user) => {
  return {
    canView:
      user.role === "admin" ||
      (user.role === "baker" && order.bakerId === user.bakerId),
    canEdit: canEditOrder(order, user),
    canDelete: canDeleteOrder(order, user),
    canAddItems: canAddItems(order, user),
    canEditItems: canEditItems(order, user),
    canDeleteItems: canDeleteItems(order, user),
    canUploadInspirationImages: canUploadInspirationImages(order, user),
    canDeleteInspirationImages: canDeleteInspirationImages(order, user),
    canUploadPreviewImages: canUploadPreviewImages(user),
    canDeletePreviewImages: canDeletePreviewImages(user),
    canTransitionStage: getNextAllowedStages(order.stage, user.role).length > 0,
    editingMessage: getEditingRestrictionsMessage(order, user),
    availableActions: getAvailableActions(order, user),
    imagePermissions: getImagePermissions(order, user),
    submissionValidation: validateOrderForSubmission(order),
  };
};

// Format date for input field (YYYY-MM-DD format)
export const formatDateForInput = (date) => {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
};

// Format pickup schedule for display
export const formatPickupSchedule = (pickupSchedule) => {
  if (!pickupSchedule || !pickupSchedule.date || !pickupSchedule.time) {
    return "Not scheduled";
  }

  const date = formatDate(pickupSchedule.date);
  const time = pickupSchedule.time;

  return `${date} at ${time}`;
};

// Format time for display (12-hour format)
export const formatTime12Hour = (time24) => {
  if (!time24) return "";

  const [hours, minutes] = time24.split(":");
  const hour12 = parseInt(hours) % 12 || 12;
  const ampm = parseInt(hours) >= 12 ? "PM" : "AM";

  return `${hour12}:${minutes} ${ampm}`;
};

// Validate pickup schedule
export const validatePickupSchedule = (pickupSchedule) => {
  if (!pickupSchedule) {
    return { valid: false, message: "Pickup schedule is required" };
  }

  if (!pickupSchedule.date) {
    return { valid: false, message: "Pickup date is required" };
  }

  if (!pickupSchedule.time) {
    return { valid: false, message: "Pickup time is required" };
  }

  // Validate date is not in the past
  const pickupDateTime = new Date(
    `${pickupSchedule.date}T${pickupSchedule.time}`
  );
  const now = new Date();

  if (pickupDateTime < now) {
    return {
      valid: false,
      message: "Pickup date and time cannot be in the past",
    };
  }

  // Validate notes length if provided
  if (pickupSchedule.notes && pickupSchedule.notes.length > 500) {
    return {
      valid: false,
      message: "Pickup notes cannot exceed 500 characters",
    };
  }

  return { valid: true };
};

// Check if pickup schedule is required
export const isPickupScheduleRequired = (deliveryMethod) => {
  return deliveryMethod === "Pickup";
};

// Get next available pickup times (helper for UI)
export const getNextAvailablePickupTimes = () => {
  const times = [];
  const startHour = 9; // 9 AM
  const endHour = 17; // 5 PM

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      const displayTime = formatTime12Hour(timeString);
      times.push({
        value: timeString,
        label: displayTime,
      });
    }
  }

  return times;
};

// Enhanced completion validation
export const validateCompletionDetails = (completionData) => {
  const validation = { valid: true, issues: [] };

  // Check delivery method
  if (!completionData.deliveryMethod) {
    validation.valid = false;
    validation.issues.push({
      field: "deliveryMethod",
      message: "Delivery method is required",
    });
  }

  // Check payment method
  if (!completionData.paymentMethod) {
    validation.valid = false;
    validation.issues.push({
      field: "paymentMethod",
      message: "Payment method is required",
    });
  }

  // Check pickup schedule if delivery method is Pickup
  if (completionData.deliveryMethod === "Pickup") {
    const pickupValidation = validatePickupSchedule(
      completionData.pickupSchedule
    );
    if (!pickupValidation.valid) {
      validation.valid = false;
      validation.issues.push({
        field: "pickupSchedule",
        message: pickupValidation.message,
      });
    }
  }

  return validation;
};
