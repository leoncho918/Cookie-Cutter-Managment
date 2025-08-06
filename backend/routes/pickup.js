// backend/routes/pickup.js - Pickup information API endpoints
const express = require("express");
const { requireBakerOrAdmin } = require("../middleware/auth");
const PICKUP_CONFIG = require("../config/pickup");

const router = express.Router();

// Get pickup location information
router.get("/location", requireBakerOrAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      data: PICKUP_CONFIG,
    });
  } catch (error) {
    console.error("Error fetching pickup location:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching pickup information",
    });
  }
});

// Get pickup availability for a specific date
router.get("/availability/:date", requireBakerOrAdmin, async (req, res) => {
  try {
    const { date } = req.params;
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.toLocaleDateString("en-US", {
      weekday: "lowercase",
    });

    // Check if the requested date is a valid business day
    const businessHours = PICKUP_CONFIG.businessHours[dayOfWeek];

    if (!businessHours || businessHours.closed) {
      return res.json({
        success: true,
        data: {
          available: false,
          reason: `We are closed on ${dayOfWeek}s`,
          businessHours: null,
        },
      });
    }

    // For now, return basic availability
    // In a real system, you might check existing bookings
    const availableTimeSlots = generateTimeSlots(
      businessHours.open,
      businessHours.close
    );

    res.json({
      success: true,
      data: {
        available: true,
        date: date,
        dayOfWeek: dayOfWeek,
        businessHours: businessHours,
        availableTimeSlots: availableTimeSlots,
      },
    });
  } catch (error) {
    console.error("Error checking pickup availability:", error);
    res.status(500).json({
      success: false,
      message: "Server error checking availability",
    });
  }
});

// Helper function to generate time slots
function generateTimeSlots(openTime, closeTime) {
  const slots = [];
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  let currentHour = openHour;
  let currentMinute = openMinute;

  while (
    currentHour < closeHour ||
    (currentHour === closeHour && currentMinute < closeMinute)
  ) {
    const timeString = `${currentHour
      .toString()
      .padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
    const displayTime = formatTime12Hour(timeString);

    slots.push({
      value: timeString,
      label: displayTime,
    });

    // Add 30-minute intervals
    currentMinute += 30;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour += 1;
    }
  }

  return slots;
}

// Helper function to format time in 12-hour format
function formatTime12Hour(time24) {
  const [hours, minutes] = time24.split(":");
  const hour12 = parseInt(hours) % 12 || 12;
  const ampm = parseInt(hours) >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes} ${ampm}`;
}

// Validate pickup time slot
router.post("/validate-slot", requireBakerOrAdmin, async (req, res) => {
  try {
    const { date, time } = req.body;

    if (!date || !time) {
      return res.status(400).json({
        success: false,
        message: "Date and time are required",
      });
    }

    const requestedDate = new Date(date);
    const now = new Date();

    // Check if date is in the past
    if (requestedDate < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot schedule pickup for a past date",
      });
    }

    // Check if the datetime combination is in the past
    const requestedDateTime = new Date(`${date}T${time}`);
    if (requestedDateTime < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot schedule pickup for a past time",
      });
    }

    const dayOfWeek = requestedDate.toLocaleDateString("en-US", {
      weekday: "lowercase",
    });
    const businessHours = PICKUP_CONFIG.businessHours[dayOfWeek];

    // Check if it's a business day
    if (!businessHours || businessHours.closed) {
      return res.status(400).json({
        success: false,
        message: `We are closed on ${dayOfWeek}s`,
      });
    }

    // Check if time is within business hours
    const [requestHour, requestMinute] = time.split(":").map(Number);
    const [openHour, openMinute] = businessHours.open.split(":").map(Number);
    const [closeHour, closeMinute] = businessHours.close.split(":").map(Number);

    const requestTimeMinutes = requestHour * 60 + requestMinute;
    const openTimeMinutes = openHour * 60 + openMinute;
    const closeTimeMinutes = closeHour * 60 + closeMinute;

    if (
      requestTimeMinutes < openTimeMinutes ||
      requestTimeMinutes >= closeTimeMinutes
    ) {
      return res.status(400).json({
        success: false,
        message: `Pickup time must be between ${formatTime12Hour(
          businessHours.open
        )} and ${formatTime12Hour(businessHours.close)}`,
      });
    }

    res.json({
      success: true,
      message: "Pickup time slot is valid",
      data: {
        date: date,
        time: time,
        dayOfWeek: dayOfWeek,
        formatted: {
          date: requestedDate.toLocaleDateString("en-AU"),
          time: formatTime12Hour(time),
        },
      },
    });
  } catch (error) {
    console.error("Error validating pickup slot:", error);
    res.status(500).json({
      success: false,
      message: "Server error validating pickup slot",
    });
  }
});

module.exports = router;
