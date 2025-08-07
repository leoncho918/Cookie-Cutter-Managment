// backend/models/Settings.js - System settings model for admin configuration
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  // Unique identifier for singleton pattern
  _id: {
    type: String,
    default: "system-settings",
  },

  // International address configuration
  internationalAddresses: {
    enabled: {
      type: Boolean,
      default: false, // Default to disabled for backward compatibility
    },
    lastModifiedBy: {
      type: String,
      ref: "User",
    },
    lastModifiedAt: {
      type: Date,
      default: Date.now,
    },
    supportedCountries: {
      type: [String],
      default: [
        "Australia",
        "United States",
        "Canada",
        "United Kingdom",
        "New Zealand",
        "Singapore",
        "Japan",
        "Germany",
        "France",
        "Italy",
        "Spain",
        "Netherlands",
        "Belgium",
        "Switzerland",
        "Sweden",
        "Norway",
        "Denmark",
        "Ireland",
        "India",
        "China",
        "South Korea",
        "Thailand",
        "Malaysia",
        "Philippines",
        "Indonesia",
        "Vietnam",
        "Brazil",
        "Mexico",
        "Argentina",
        "Chile",
        "South Africa",
        "Other",
      ],
    },
    notes: {
      type: String,
      maxlength: 1000,
      default: "International delivery settings controlled by admin",
    },
  },

  // Future settings can be added here
  orderSettings: {
    maxItemsPerOrder: {
      type: Number,
      default: 20,
    },
    defaultOrderExpiration: {
      type: Number,
      default: 30, // days
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
settingsSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get or create settings
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findById("system-settings");

  if (!settings) {
    // Create default settings if they don't exist
    settings = new this({
      _id: "system-settings",
    });
    await settings.save();
    console.log("✅ Created default system settings");
  }

  return settings;
};

// Static method to update international address setting
settingsSchema.statics.updateInternationalSettings = async function (
  enabled,
  adminUserId,
  notes
) {
  const settings = await this.getSettings();

  settings.internationalAddresses.enabled = enabled;
  settings.internationalAddresses.lastModifiedBy = adminUserId;
  settings.internationalAddresses.lastModifiedAt = new Date();

  if (notes !== undefined) {
    settings.internationalAddresses.notes = notes;
  }

  await settings.save();

  console.log(
    `🌍 International addresses ${
      enabled ? "enabled" : "disabled"
    } by admin ${adminUserId}`
  );

  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
