// backend/routes/settings.js - System settings API endpoints
const express = require("express");
const Settings = require("../models/Setting");
const { requireAdmin, requireBakerOrAdmin } = require("../middleware/auth");
const { emitSystemNotification } = require("../utils/socketUtils");

const router = express.Router();

// Get system settings (accessible to all authenticated users)
router.get("/", requireBakerOrAdmin, async (req, res) => {
  try {
    console.log("📋 Fetching system settings for user:", req.user.email);

    const settings = await Settings.getSettings();

    // Return public settings only (hide sensitive admin info for non-admins)
    const publicSettings = {
      internationalAddresses: {
        enabled: settings.internationalAddresses.enabled,
        supportedCountries: settings.internationalAddresses.supportedCountries,
      },
      orderSettings: settings.orderSettings,
      updatedAt: settings.updatedAt,
    };

    // Include admin-only fields if user is admin
    if (req.user.role === "admin") {
      publicSettings.internationalAddresses.lastModifiedBy =
        settings.internationalAddresses.lastModifiedBy;
      publicSettings.internationalAddresses.lastModifiedAt =
        settings.internationalAddresses.lastModifiedAt;
      publicSettings.internationalAddresses.notes =
        settings.internationalAddresses.notes;
      publicSettings.createdAt = settings.createdAt;
      publicSettings._id = settings._id;
    }

    console.log("✅ Settings retrieved:", {
      internationalEnabled: settings.internationalAddresses.enabled,
      userRole: req.user.role,
      lastModified: settings.internationalAddresses.lastModifiedAt,
    });

    res.json({
      success: true,
      data: publicSettings,
    });
  } catch (error) {
    console.error("❌ Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching system settings",
    });
  }
});

// Update international address settings (Admin only)
router.put("/international", requireAdmin, async (req, res) => {
  try {
    const { enabled, notes } = req.body;

    console.log("🌍 International settings update request:", {
      enabled,
      notes: notes ? notes.substring(0, 50) + "..." : "No notes",
      requestedBy: req.user.email,
    });

    // Validate input
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid 'enabled' value. Must be true or false.",
      });
    }

    if (notes && notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Notes cannot exceed 1000 characters",
      });
    }

    // Update settings
    const settings = await Settings.updateInternationalSettings(
      enabled,
      req.user._id,
      notes
    );

    console.log("✅ International settings updated:", {
      enabled: settings.internationalAddresses.enabled,
      modifiedBy: req.user.email,
      timestamp: settings.internationalAddresses.lastModifiedAt,
    });

    // Emit real-time notification to all users
    const io = req.app.get("io");
    if (io) {
      const message = `International delivery ${
        enabled ? "enabled" : "disabled"
      } by admin`;
      const targetRooms = ["admins", "bakers"];

      emitSystemNotification(io, message, "info", targetRooms);

      // Also emit a specific settings update event
      io.to("admins").emit("settings-updated", {
        type: "international-addresses",
        enabled,
        updatedBy: {
          email: req.user.email,
          id: req.user._id,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: `International delivery ${
        enabled ? "enabled" : "disabled"
      } successfully`,
      data: {
        internationalAddresses: {
          enabled: settings.internationalAddresses.enabled,
          lastModifiedBy: settings.internationalAddresses.lastModifiedBy,
          lastModifiedAt: settings.internationalAddresses.lastModifiedAt,
          notes: settings.internationalAddresses.notes,
          supportedCountries:
            settings.internationalAddresses.supportedCountries,
        },
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating international settings:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating international settings",
    });
  }
});

// Get international address status (quick endpoint for checking)
router.get("/international/status", requireBakerOrAdmin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    res.json({
      success: true,
      data: {
        enabled: settings.internationalAddresses.enabled,
        supportedCountriesCount:
          settings.internationalAddresses.supportedCountries.length,
        lastModified: settings.internationalAddresses.lastModifiedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching international status:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching international status",
    });
  }
});

// Update supported countries list (Admin only)
router.put("/international/countries", requireAdmin, async (req, res) => {
  try {
    const { countries } = req.body;

    if (!Array.isArray(countries) || countries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Countries must be a non-empty array",
      });
    }

    // Validate countries array
    const validCountries = countries.filter(
      (country) => typeof country === "string" && country.trim().length > 0
    );

    if (validCountries.length !== countries.length) {
      return res.status(400).json({
        success: false,
        message: "All countries must be non-empty strings",
      });
    }

    const settings = await Settings.getSettings();
    settings.internationalAddresses.supportedCountries = validCountries;
    settings.internationalAddresses.lastModifiedBy = req.user._id;
    settings.internationalAddresses.lastModifiedAt = new Date();

    await settings.save();

    console.log("🌍 Supported countries updated:", {
      count: validCountries.length,
      updatedBy: req.user.email,
    });

    // Emit real-time notification
    const io = req.app.get("io");
    if (io) {
      emitSystemNotification(
        io,
        `Supported countries list updated (${validCountries.length} countries)`,
        "info",
        ["admins"]
      );
    }

    res.json({
      success: true,
      message: "Supported countries updated successfully",
      data: {
        supportedCountries: settings.internationalAddresses.supportedCountries,
        count: settings.internationalAddresses.supportedCountries.length,
      },
    });
  } catch (error) {
    console.error("❌ Error updating supported countries:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating supported countries",
    });
  }
});

// Reset settings to defaults (Admin only) - Emergency use
router.post("/reset", requireAdmin, async (req, res) => {
  try {
    const { confirmReset } = req.body;

    if (!confirmReset) {
      return res.status(400).json({
        success: false,
        message: "Confirmation required to reset settings",
      });
    }

    // Delete existing settings to force recreation with defaults
    await Settings.findByIdAndDelete("system-settings");

    // Create new default settings
    const newSettings = await Settings.getSettings();

    console.log("🔄 Settings reset to defaults by admin:", req.user.email);

    // Emit real-time notification
    const io = req.app.get("io");
    if (io) {
      emitSystemNotification(
        io,
        "System settings reset to defaults by admin",
        "warning",
        ["admins", "bakers"]
      );
    }

    res.json({
      success: true,
      message: "Settings reset to defaults successfully",
      data: {
        internationalAddresses: newSettings.internationalAddresses,
        resetBy: req.user.email,
        resetAt: newSettings.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error resetting settings:", error);
    res.status(500).json({
      success: false,
      message: "Server error resetting settings",
    });
  }
});

module.exports = router;
