import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Button from "../UI/Button";
import Modal from "../UI/Modal";
import { formatDate } from "../../utils/orderHelpers";
import axios from "axios";

const UpdateRequests = () => {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responseModal, setResponseModal] = useState({
    isOpen: false,
    orderId: "",
    action: "",
    adminResponse: "",
  });

  useEffect(() => {
    if (user.role === "admin") {
      loadUpdateRequests();
    }
  }, [user.role]);

  const loadUpdateRequests = async () => {
    try {
      const response = await axios.get("/orders", {
        params: { pendingUpdates: true },
      });
      setRequests(response.data.orders || []);
    } catch (error) {
      console.error("Error loading update requests:", error);
      showError("Failed to load update requests");
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async () => {
    try {
      await axios.put(
        `/orders/${responseModal.orderId}/update-request/${responseModal.action}`,
        { adminResponse: responseModal.adminResponse }
      );

      showSuccess(`Update request ${responseModal.action}d successfully`);
      setResponseModal({
        isOpen: false,
        orderId: "",
        action: "",
        adminResponse: "",
      });
      loadUpdateRequests();
    } catch (error) {
      console.error("Error responding to update request:", error);
      showError("Failed to respond to update request");
    }
  };

  if (user.role !== "admin") {
    return <div>Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Pending Update Requests</h2>

      {loading ? (
        <div>Loading...</div>
      ) : requests.length === 0 ? (
        <p className="text-gray-600">No pending update requests</p>
      ) : (
        <div className="space-y-4">
          {requests.map((order) => (
            <div key={order._id} className="bg-white border rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">
                    Order {order.orderNumber}
                  </h3>
                  <p className="text-gray-600">Baker: {order.bakerEmail}</p>
                  <p className="text-gray-600">
                    Requested: {formatDate(order.updateRequest.requestedAt)}
                  </p>
                  <p className="text-gray-600 mt-2">
                    <strong>Reason:</strong> {order.updateRequest.reason}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() =>
                      setResponseModal({
                        isOpen: true,
                        orderId: order._id,
                        action: "approve",
                        adminResponse: "",
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() =>
                      setResponseModal({
                        isOpen: true,
                        orderId: order._id,
                        action: "reject",
                        adminResponse: "",
                      })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Response Modal */}
      <Modal
        isOpen={responseModal.isOpen}
        onClose={() =>
          setResponseModal({
            isOpen: false,
            orderId: "",
            action: "",
            adminResponse: "",
          })
        }
        title={`${
          responseModal.action === "approve" ? "Approve" : "Reject"
        } Update Request`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response to Baker (Optional)
            </label>
            <textarea
              value={responseModal.adminResponse}
              onChange={(e) =>
                setResponseModal((prev) => ({
                  ...prev,
                  adminResponse: e.target.value,
                }))
              }
              placeholder="Add any notes for the baker..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[80px]"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() =>
                setResponseModal({
                  isOpen: false,
                  orderId: "",
                  action: "",
                  adminResponse: "",
                })
              }
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleResponse}>
              {responseModal.action === "approve"
                ? "Approve Request"
                : "Reject Request"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UpdateRequests;
