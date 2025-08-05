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
    subject: "Welcome to Cookie Cutter Order Management System",
    html: `
      <h2>Welcome to Cookie Cutter Orders!</h2>
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
      <p>Please log in to the system and start managing your orders!</p>
      <br>
      <p>Best regards,<br>Cookie Cutter Order Management Team</p>
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
    subject: "Password Reset - Cookie Cutter Order Management",
    html: `
            <h2>Password Reset Request</h2>
            <p>Your password has been reset. Please use the following temporary password to log in:</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            <p><strong>Important:</strong> You will be required to change this password on your next login.</p>
            <p>If you did not request this password reset, please contact the administrator immediately.</p>
            <br>
            <p>Best regards,<br>Cookie Cutter Order Management Team</p>
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
            <p>Best regards,<br>Cookie Cutter Order Management Team</p>
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

module.exports = {
  generateRandomPassword,
  sendAccountCreationEmail,
  sendPasswordResetEmail,
  sendOrderStageChangeEmail,
};
