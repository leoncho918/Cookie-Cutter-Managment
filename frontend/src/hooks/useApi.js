// src/hooks/useApi.js - Custom hook for API calls with error handling
import { useState } from "react";
import { useToast } from "../contexts/ToastContext";
import axios from "axios";

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useToast();

  const apiCall = async (
    apiFunction,
    {
      successMessage = null,
      errorMessage = null,
      showSuccessToast = false,
      showErrorToast = true,
    } = {}
  ) => {
    setLoading(true);

    try {
      const result = await apiFunction();

      if (showSuccessToast && successMessage) {
        showSuccess(successMessage);
      }

      return { success: true, data: result };
    } catch (error) {
      console.error("API call error:", error);

      const message =
        errorMessage ||
        error.response?.data?.message ||
        "An unexpected error occurred";

      if (showErrorToast) {
        showError(message);
      }

      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  return { loading, apiCall };
};
