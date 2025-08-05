// src/utils/orderHelpers.js - Order utility functions with measurement support
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

export const MEASUREMENT_DIMENSIONS = {
  LENGTH: "length",
  WIDTH: "width",
  DIAMETER: "diameter",
};

export const DELIVERY_METHODS = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
};

export const PAYMENT_METHODS = {
  CASH: "Cash",
  CARD: "Card",
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
        ORDER_STAGES.REQUESTED_CHANGES,
        ORDER_STAGES.SUBMITTED,
      ], // Can go back
      [ORDER_STAGES.REQUIRES_APPROVAL]: [
        ORDER_STAGES.REQUESTED_CHANGES,
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
      [ORDER_STAGES.REQUIRES_APPROVAL]: [ORDER_STAGES.READY_TO_PRINT], // Baker approves
      [ORDER_STAGES.REQUESTED_CHANGES]: [], // Wait for admin to make changes
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

// Format date for display
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Format date for input field
export const formatDateForInput = (date) => {
  return new Date(date).toISOString().split("T")[0];
};

// Format measurement for display
export const formatMeasurement = (measurement) => {
  if (!measurement || !measurement.value || measurement.value === "") {
    return "Not specified";
  }

  return `${measurement.value}${measurement.unit || "cm"} (${
    measurement.dimension || "length"
  })`;
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

  if (
    !measurement.dimension ||
    !Object.values(MEASUREMENT_DIMENSIONS).includes(measurement.dimension)
  ) {
    return { valid: false, message: "Valid measurement dimension is required" };
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

// Check if user can edit order
export const canEditOrder = (order, user) => {
  if (user.role === "admin") return true;
  if (
    user.role === "baker" &&
    order.bakerId === user.bakerId &&
    order.stage === ORDER_STAGES.DRAFT
  ) {
    return true;
  }
  return false;
};

// Check if user can delete order
export const canDeleteOrder = (order, user) => {
  if (user.role === "admin") return true;
  if (
    user.role === "baker" &&
    order.bakerId === user.bakerId &&
    order.stage === ORDER_STAGES.DRAFT
  ) {
    return true;
  }
  return false;
};
