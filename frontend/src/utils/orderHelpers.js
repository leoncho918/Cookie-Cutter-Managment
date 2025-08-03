// src/utils/orderHelpers.js - Order utility functions
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
  const transitions = {
    [ORDER_STAGES.DRAFT]: userRole === "baker" ? [ORDER_STAGES.SUBMITTED] : [],
    [ORDER_STAGES.SUBMITTED]:
      userRole === "admin" ? [ORDER_STAGES.UNDER_REVIEW] : [],
    [ORDER_STAGES.UNDER_REVIEW]:
      userRole === "admin"
        ? [ORDER_STAGES.REQUIRES_APPROVAL, ORDER_STAGES.REQUESTED_CHANGES]
        : [],
    [ORDER_STAGES.REQUIRES_APPROVAL]:
      userRole === "baker"
        ? [ORDER_STAGES.READY_TO_PRINT]
        : userRole === "admin"
        ? [ORDER_STAGES.REQUESTED_CHANGES]
        : [],
    [ORDER_STAGES.REQUESTED_CHANGES]:
      userRole === "admin" ? [ORDER_STAGES.UNDER_REVIEW] : [],
    [ORDER_STAGES.READY_TO_PRINT]:
      userRole === "admin" ? [ORDER_STAGES.PRINTING] : [],
    [ORDER_STAGES.PRINTING]:
      userRole === "admin" ? [ORDER_STAGES.COMPLETED] : [],
    [ORDER_STAGES.COMPLETED]: [],
  };

  return transitions[currentStage] || [];
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
