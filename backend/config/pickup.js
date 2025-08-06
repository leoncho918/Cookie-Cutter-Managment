// backend/config/pickup.js - Pickup location configuration
const PICKUP_CONFIG = {
  address: {
    street: "40A Brancourt Ave",
    suburb: "Bankstown",
    state: "NSW",
    postcode: "2200",
    country: "Australia",
    full: "40A Brancourt Ave, Bankstown NSW 2200, Australia",
  },
  coordinates: {
    latitude: -33.9137, // Approximate coordinates for Bankstown
    longitude: 151.0351,
  },
  businessHours: {
    monday: { open: "09:00", close: "23:59" },
    tuesday: { open: "09:00", close: "23:59" },
    wednesday: { open: "09:00", close: "23:59" },
    thursday: { open: "09:00", close: "23:59" },
    friday: { open: "09:00", close: "23:59" },
    saturday: { open: "09:00", close: "23:59" },
    sunday: { open: "09:00", close: "23:59" },
  },
  contact: {
    phone: "+61 423 038 401", // Update with actual phone number
    email: "leoncho918@gmail.com", // Update with actual email
  },
  instructions: [
    "Please call before you start making your way",
    "Call ahead if you're running late",
    "Drive down the driveway and park in the front yard",
    "Ring the doorbell at the front door",
  ],
  // Google Maps embed URL
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3312.5!2d151.0351!3d-33.9137!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b12bb7b4c5b5b5b%3A0x5b5b5b5b5b5b5b5b!2s40A%20Brancourt%20Ave%2C%20Bankstown%20NSW%202200%2C%20Australia!5e0!3m2!1sen!2sau!4v1234567890!5m2!1sen!2sau",
};

module.exports = PICKUP_CONFIG;
