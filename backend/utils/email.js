// utils/email.js - Email utility functions using Nodemailer
const nodemailer = require("nodemailer");

// Create transporter (configure with your email service)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Generate random password
const generateRandomPassword = (length = 12) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Enhanced account creation email with personal details
const sendAccountCreationEmail = async (
  email,
  bakerId,
  temporaryPassword,
  userDetails = {}
) => {
  const transporter = createTransporter();

  const { firstName, lastName, phoneNumber } = userDetails;
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : "Baker";

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to the Cookie Cutter Ordering System",
    html: `
      <h2>Welcome to Cookie Cutter Ordering System!</h2>
      ${firstName ? `<p>Hello ${fullName},</p>` : ""}
      <p>Your baker account has been created with the following credentials:</p>
      <ul>
        ${firstName ? `<li><strong>Name:</strong> ${fullName}</li>` : ""}
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Baker ID:</strong> ${bakerId}</li>
        ${phoneNumber ? `<li><strong>Phone:</strong> ${phoneNumber}</li>` : ""}
        <li><strong>Temporary Password:</strong> ${temporaryPassword}</li>
      </ul>
      <p><strong>Important:</strong> You will be required to change your password on first login.</p>
      <p>Please log in to the system and start creating orders!</p>
      <br>
      <p>Best regards,<br>Leon</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Account creation email sent to:", email, {
      fullName,
      bakerId,
      phoneNumber: phoneNumber || "Not provided",
    });
    return true;
  } catch (error) {
    console.error("Error sending account creation email:", error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, temporaryPassword) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset - Cookie Cutter Ordering System",
    html: `
            <h2>Password Reset Request</h2>
            <p>Your password has been reset. Please use the following temporary password to log in:</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            <p><strong>Important:</strong> You will be required to change this password on your next login.</p>
            <p>If you did not request this password reset, please contact the administrator immediately.</p>
            <br>
            <p>Best regards,<br>Leon</p>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
};

// Send order stage change notification
const sendOrderStageChangeEmail = async (
  bakerEmail,
  orderNumber,
  newStage,
  comments = ""
) => {
  const transporter = createTransporter();

  const stageMessages = {
    "Under Review": "Your order is now under review by our admin team.",
    "Requires Approval":
      "Your order requires your approval. Please review the pricing and details.",
    "Requested Changes":
      "Changes have been requested for your order. Please review the comments.",
    "Ready to Print": "Great news! Your order is ready to print.",
    Printing: "Your order is currently being printed.",
    Completed:
      "Your order has been completed and is ready for pickup/delivery.",
  };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: bakerEmail,
    subject: `Order Update - ${orderNumber}`,
    html: `
            <h2>Order Status Update</h2>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>New Status:</strong> ${newStage}</p>
            <p>${
              stageMessages[newStage] || "Your order status has been updated."
            }</p>
            ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ""}
            <p>Please log in to the system to view your order details and take any necessary actions.</p>
            <br>
            <p>Best regards,<br>Leon</p>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Order stage change email sent to:", bakerEmail);
    return true;
  } catch (error) {
    console.error("Error sending order stage change email:", error);
    return false;
  }
};

const sendUpdateRequestNotification = async (
  bakerEmail,
  orderNumber,
  reason
) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL, // You'll need to add this env variable
    subject: `Update Request - Order ${orderNumber}`,
    html: `
      <h2>Collection & Payment Update Request</h2>
      <p><strong>Order Number:</strong> ${orderNumber}</p>
      <p><strong>Requested by:</strong> ${bakerEmail}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>A baker has requested to update their collection and payment details for a completed order.</p>
      <p>Please log in to the admin panel to review and approve/reject this request.</p>
      <br>
      <p>Best regards,<br>System</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Update request notification sent to admin");
    return true;
  } catch (error) {
    console.error("Error sending update request notification:", error);
    return false;
  }
};

// Send update request response to baker
const sendUpdateRequestResponseEmail = async (
  bakerEmail,
  orderNumber,
  action,
  adminResponse
) => {
  const transporter = createTransporter();

  const actionMessages = {
    approve:
      "Your request to update collection and payment details has been approved.",
    reject:
      "Your request to update collection and payment details has been rejected.",
  };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: bakerEmail,
    subject: `Update Request ${
      action === "approve" ? "Approved" : "Rejected"
    } - Order ${orderNumber}`,
    html: `
      <h2>Update Request Response</h2>
      <p><strong>Order Number:</strong> ${orderNumber}</p>
      <p><strong>Status:</strong> ${
        action === "approve" ? "Approved" : "Rejected"
      }</p>
      <p>${actionMessages[action]}</p>
      ${
        adminResponse
          ? `<p><strong>Admin Notes:</strong> ${adminResponse}</p>`
          : ""
      }
      ${
        action === "approve"
          ? "<p>You can now update your collection and payment details in the order page.</p>"
          : ""
      }
      <p>Please log in to the system to view your order details.</p>
      <br>
      <p>Best regards,<br>Leon</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Update request ${action} email sent to:`, bakerEmail);
    return true;
  } catch (error) {
    console.error(`Error sending update request ${action} email:`, error);
    return false;
  }
};

// NEW: Send completion details confirmation email
const sendCompletionDetailsConfirmedEmail = async (
  bakerEmail,
  orderNumber,
  deliveryMethod,
  paymentMethod,
  pickupSchedule,
  deliveryAddress
) => {
  const transporter = createTransporter();

  // Format delivery details for email
  let deliveryDetails = "";
  if (deliveryMethod === "Pickup" && pickupSchedule) {
    deliveryDetails = `
      <p><strong>Pickup Details:</strong></p>
      <ul>
        <li>Date: ${new Date(pickupSchedule.date).toLocaleDateString(
          "en-AU"
        )}</li>
        <li>Time: ${pickupSchedule.time}</li>
        ${pickupSchedule.notes ? `<li>Notes: ${pickupSchedule.notes}</li>` : ""}
      </ul>
    `;
  } else if (deliveryMethod === "Delivery" && deliveryAddress) {
    deliveryDetails = `
      <p><strong>Delivery Address:</strong></p>
      <ul>
        <li>${deliveryAddress.street}</li>
        <li>${deliveryAddress.suburb} ${deliveryAddress.state} ${
      deliveryAddress.postcode
    }</li>
        <li>${deliveryAddress.country}</li>
        ${
          deliveryAddress.instructions
            ? `<li>Instructions: ${deliveryAddress.instructions}</li>`
            : ""
        }
      </ul>
    `;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: bakerEmail,
    subject: `Collection & Payment Details Confirmed - ${orderNumber}`,
    html: `
      <h2>Collection & Payment Details Confirmed</h2>
      <p><strong>Order Number:</strong> ${orderNumber}</p>
      <p>Your collection and payment details have been confirmed and are now locked.</p>
      
      <h3>Confirmed Details:</h3>
      <p><strong>Collection Method:</strong> ${deliveryMethod}</p>
      <p><strong>Payment Method:</strong> ${paymentMethod}</p>
      ${deliveryDetails}
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Important:</strong> These details are now confirmed and locked. If you need to make any changes, please contact the admin to request an update.</p>
      </div>
      
      <p>Thank you for confirming your details. We'll be in touch regarding your order.</p>
      <br>
      <p>Best regards,<br>Leon</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Completion details confirmed email sent to:", bakerEmail);
    return true;
  } catch (error) {
    console.error("Error sending completion details confirmed email:", error);
    return false;
  }
};

module.exports = {
  generateRandomPassword,
  sendAccountCreationEmail,
  sendPasswordResetEmail,
  sendOrderStageChangeEmail,
  sendCompletionDetailsConfirmedEmail,
  sendUpdateRequestNotification,
  sendUpdateRequestResponseEmail,
};
