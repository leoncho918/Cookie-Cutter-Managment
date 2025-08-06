// src/components/Orders/PickupDetails.js - Pickup location details component
import React, { useState } from "react";
import Button from "../UI/Button";

const PickupDetails = ({ order, onClose }) => {
  const [showMap, setShowMap] = useState(true);

  // Pickup configuration - in production this would come from an API
  const pickupConfig = {
    address: {
      street: "40A Brancourt Ave",
      suburb: "Bankstown",
      state: "NSW",
      postcode: "2200",
      country: "Australia",
      full: "40A Brancourt Ave, Bankstown NSW 2200, Australia",
    },
    contact: {
      phone: "+61 2 9000 0000",
      email: "pickup@cookiecutter.com",
    },
    businessHours: {
      monday: "9:00 AM - 5:00 PM",
      tuesday: "9:00 AM - 5:00 PM",
      wednesday: "9:00 AM - 5:00 PM",
      thursday: "9:00 AM - 5:00 PM",
      friday: "9:00 AM - 5:00 PM",
      saturday: "10:00 AM - 2:00 PM",
      sunday: "Closed",
    },
    instructions: [
      "Please bring photo ID for pickup verification",
      "Call ahead if you're running late",
      "Park in visitor parking spaces",
      "Ring the doorbell at unit 40A",
    ],
  };

  const formatPickupDateTime = () => {
    if (!order.pickupSchedule?.date || !order.pickupSchedule?.time) {
      return "Not scheduled";
    }

    const date = new Date(order.pickupSchedule.date);
    const formattedDate = date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return `${formattedDate} at ${order.pickupSchedule.time}`;
  };

  const getGoogleMapsUrl = () => {
    const address = encodeURIComponent(pickupConfig.address.full);
    return `https://www.google.com/maps/search/?api=1&query=${address}`;
  };

  const getDirectionsUrl = () => {
    const address = encodeURIComponent(pickupConfig.address.full);
    return `https://www.google.com/maps/dir/?api=1&destination=${address}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100 mb-4">
          <span className="text-2xl">🚶</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Pickup Details</h2>
        <p className="text-gray-600 mt-1">Order {order.orderNumber}</p>
      </div>

      {/* Scheduled Pickup Time */}
      {order.pickupSchedule && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-800 mb-2">
            📅 Your Scheduled Pickup
          </h3>
          <div className="text-blue-700">
            <p className="text-lg font-semibold">{formatPickupDateTime()}</p>
            {order.pickupSchedule.notes && (
              <p className="text-sm mt-2">
                <strong>Notes:</strong> {order.pickupSchedule.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Address Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          📍 Pickup Address
        </h3>

        <div className="space-y-3">
          <div className="text-gray-900">
            <div className="font-semibold text-lg">
              {pickupConfig.address.street}
            </div>
            <div>
              {pickupConfig.address.suburb} {pickupConfig.address.state}{" "}
              {pickupConfig.address.postcode}
            </div>
            <div>{pickupConfig.address.country}</div>
          </div>

          {/* Contact Information */}
          <div className="pt-3 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">
              Contact Information
            </h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">📞</span>
                <a
                  href={`tel:${pickupConfig.contact.phone}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {pickupConfig.contact.phone}
                </a>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">✉️</span>
                <a
                  href={`mailto:${pickupConfig.contact.email}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {pickupConfig.contact.email}
                </a>
              </div>
            </div>
          </div>

          {/* Map Actions */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="small"
                onClick={() => window.open(getDirectionsUrl(), "_blank")}
              >
                🗺️ Get Directions
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={() => window.open(getGoogleMapsUrl(), "_blank")}
              >
                📍 View on Google Maps
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? "🙈 Hide Map" : "🗺️ Show Map"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Map */}
      {showMap && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              🗺️ Location Map
            </h3>
          </div>
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3312.5!2d151.0351!3d-33.9137!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b12bb7b4c5b5b5b%3A0x5b5b5b5b5b5b5b5b!2s40A%20Brancourt%20Ave%2C%20Bankstown%20NSW%202200%2C%20Australia!5e0!3m2!1sen!2sau!4v1234567890!5m2!1sen!2sau`}
              width="100%"
              height="100%"
              style={{
                border: 0,
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Pickup Location Map"
            />
          </div>
        </div>
      )}

      {/* Business Hours */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          🕒 Business Hours
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {Object.entries(pickupConfig.businessHours).map(([day, hours]) => (
            <div key={day} className="flex justify-between">
              <span className="font-medium capitalize text-gray-700">
                {day}:
              </span>
              <span className="text-gray-600">{hours}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pickup Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-yellow-800 mb-4">
          📋 Pickup Instructions
        </h3>
        <ul className="space-y-2 text-sm text-yellow-700">
          {pickupConfig.instructions.map((instruction, index) => (
            <li key={index} className="flex items-start">
              <span className="text-yellow-600 mr-2">•</span>
              <span>{instruction}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Location Image Placeholder */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          📷 Location Photo
        </h3>
        <div className="text-center">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-gray-500">
              <span className="text-4xl block mb-2">🏢</span>
              <p className="text-sm">Location photo will be displayed here</p>
              <p className="text-xs mt-1 text-gray-400">
                Place your location image in: <br />
                <code>frontend/public/images/pickup-location.png</code>
              </p>
            </div>
          </div>
          {/* This will show the actual image once placed */}
          <img
            src="/images/pickup-location.png"
            alt="Pickup Location"
            className="mt-4 rounded-lg border border-gray-200 w-full max-w-md mx-auto"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <Button
          variant="primary"
          onClick={() => window.open(getDirectionsUrl(), "_blank")}
        >
          🚗 Get Directions
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default PickupDetails;
