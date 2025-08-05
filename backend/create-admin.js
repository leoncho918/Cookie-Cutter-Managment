// create-admin.js - Fixed script to create initial admin user with name and phone
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
require("dotenv").config({ path: ".env" });

// Enhanced User schema (matches your backend model)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ["admin", "baker"],
    required: true,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[\+]?[\d\s\-\(\)]{10,15}$/.test(v);
      },
      message: "Please enter a valid phone number",
    },
  },
  bakerId: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
  },
  isFirstLogin: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
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

const User = mongoose.model("User", userSchema);

// Simple readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

// Simplified password input - visible for reliability
const askPassword = (question) => {
  console.log("\n⚠️  Note: Password will be visible on screen for reliability");
  return askQuestion(question);
};

// Email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Name validation function
const validateName = (name, fieldName) => {
  if (!name || name.trim().length < 2) {
    return {
      valid: false,
      message: `${fieldName} must be at least 2 characters long`,
    };
  }
  if (name.trim().length > 50) {
    return {
      valid: false,
      message: `${fieldName} must be less than 50 characters long`,
    };
  }
  return { valid: true };
};

// Phone validation function
const validatePhone = (phoneNumber) => {
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return {
      valid: false,
      message:
        "Phone number must be 10-15 digits and may include +, spaces, dashes, or parentheses",
    };
  }
  return { valid: true };
};

// Password validation function
const validatePassword = (password) => {
  if (password.length < 6) {
    return {
      valid: false,
      message: "Password must be at least 6 characters long",
    };
  }
  if (password.length > 100) {
    return {
      valid: false,
      message: "Password must be less than 100 characters long",
    };
  }
  return { valid: true };
};

// Main function to create admin user
async function createAdminUser() {
  console.log("🍪 Cookie Cutter Order Management - Admin User Creation");
  console.log("====================================================\n");

  try {
    // Check environment variables
    if (!process.env.MONGODB_URI) {
      console.error("❌ Error: MONGODB_URI not found in environment variables");
      console.log(
        "Please make sure you have a .env file in the backend folder with MONGODB_URI set"
      );
      process.exit(1);
    }

    // Connect to MongoDB
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB successfully\n");

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("⚠️  Warning: An admin user already exists!");
      if (existingAdmin.firstName && existingAdmin.lastName) {
        console.log(
          `   Name: ${existingAdmin.firstName} ${existingAdmin.lastName}`
        );
      }
      console.log(`   Email: ${existingAdmin.email}`);
      if (existingAdmin.phoneNumber) {
        console.log(`   Phone: ${existingAdmin.phoneNumber}`);
      }
      console.log(
        `   Created: ${existingAdmin.createdAt.toLocaleDateString()}\n`
      );

      const overwrite = await askQuestion(
        "Do you want to create another admin user? (y/N): "
      );
      if (
        overwrite.toLowerCase() !== "y" &&
        overwrite.toLowerCase() !== "yes"
      ) {
        console.log("Operation cancelled.");
        rl.close();
        process.exit(0);
      }
      console.log("");
    }

    // Get admin details from user
    let firstName, lastName, email, phoneNumber, password, confirmPassword;

    // Get first name
    while (true) {
      firstName = await askQuestion("Enter admin first name: ");

      const firstNameValidation = validateName(firstName, "First name");
      if (!firstNameValidation.valid) {
        console.log(`❌ ${firstNameValidation.message}. Please try again.\n`);
        continue;
      }
      break;
    }

    // Get last name
    while (true) {
      lastName = await askQuestion("Enter admin last name: ");

      const lastNameValidation = validateName(lastName, "Last name");
      if (!lastNameValidation.valid) {
        console.log(`❌ ${lastNameValidation.message}. Please try again.\n`);
        continue;
      }
      break;
    }

    // Get email
    while (true) {
      email = await askQuestion("Enter admin email address: ");

      if (!email) {
        console.log("❌ Email cannot be empty. Please try again.\n");
        continue;
      }

      if (!validateEmail(email)) {
        console.log("❌ Invalid email format. Please try again.\n");
        continue;
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        console.log(
          "❌ A user with this email already exists. Please use a different email.\n"
        );
        continue;
      }
      break;
    }

    // Get phone number
    while (true) {
      phoneNumber = await askQuestion("Enter admin phone number: ");

      if (!phoneNumber) {
        console.log("❌ Phone number cannot be empty. Please try again.\n");
        continue;
      }

      const phoneValidation = validatePhone(phoneNumber);
      if (!phoneValidation.valid) {
        console.log(`❌ ${phoneValidation.message}. Please try again.\n`);
        continue;
      }

      // Check if phone number already exists
      const existingUserWithPhone = await User.findOne({
        phoneNumber: phoneNumber.trim(),
      });
      if (existingUserWithPhone) {
        console.log(
          "❌ A user with this phone number already exists. Please use a different phone number.\n"
        );
        continue;
      }
      break;
    }

    // Get password
    while (true) {
      password = await askPassword("Enter admin password: ");

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        console.log(`❌ ${passwordValidation.message}. Please try again.\n`);
        continue;
      }

      confirmPassword = await askPassword("Confirm admin password: ");

      if (password !== confirmPassword) {
        console.log("❌ Passwords do not match. Please try again.\n");
        continue;
      }
      break;
    }

    // Ask about first login requirement
    const requireFirstLogin = await askQuestion(
      "Require password change on first login? (Y/n): "
    );
    const isFirstLogin =
      requireFirstLogin.toLowerCase() !== "n" &&
      requireFirstLogin.toLowerCase() !== "no";

    console.log("\n📋 Admin User Details:");
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Role: Admin`);
    console.log(`   First Login Required: ${isFirstLogin ? "Yes" : "No"}`);
    console.log("");

    const confirm = await askQuestion("Create this admin user? (Y/n): ");
    if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      console.log("Operation cancelled.");
      rl.close();
      process.exit(0);
    }

    // Hash password
    console.log("\n🔐 Hashing password...");
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    console.log("👤 Creating admin user...");
    const adminUser = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
      isFirstLogin: isFirstLogin,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await adminUser.save();

    console.log("\n🎉 Admin user created successfully!");
    console.log("=====================================");
    console.log(`👤 Name: ${adminUser.firstName} ${adminUser.lastName}`);
    console.log(`📧 Email: ${adminUser.email}`);
    console.log(`📞 Phone: ${adminUser.phoneNumber}`);
    console.log(`🆔 User ID: ${adminUser._id}`);
    console.log(`👑 Role: ${adminUser.role}`);
    console.log(`📅 Created: ${adminUser.createdAt.toLocaleString()}`);
    console.log(
      `🔑 First Login Required: ${adminUser.isFirstLogin ? "Yes" : "No"}`
    );
    console.log("");
    console.log(
      "🚀 You can now log in to the application with these credentials!"
    );
    console.log("   URL: http://localhost:3000");

    if (isFirstLogin) {
      console.log("");
      console.log(
        "⚠️  IMPORTANT: You will be prompted to change your password on first login."
      );
    }
  } catch (error) {
    console.error("\n❌ Error creating admin user:");

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === "email") {
        console.error("   Email address already exists in the database");
      } else if (field === "phoneNumber") {
        console.error("   Phone number already exists in the database");
      } else {
        console.error("   Duplicate value detected:", field);
      }
    } else if (error.name === "ValidationError") {
      console.error("   Validation error:", error.message);
    } else if (error.name === "MongoNetworkError") {
      console.error(
        "   Cannot connect to MongoDB. Please check your connection string and ensure MongoDB is running"
      );
    } else {
      console.error("   ", error.message);
    }

    console.log("\n🔧 Troubleshooting tips:");
    console.log("   1. Check that MongoDB is running");
    console.log("   2. Verify MONGODB_URI in backend/.env file");
    console.log("   3. Ensure you have write permissions to the database");
    console.log("   4. Make sure email and phone number are unique");
  } finally {
    rl.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("\n🔌 Disconnected from MongoDB");
    }
    process.exit(0);
  }
}

// Simple admin creation function for command line arguments
async function createSimpleAdmin(
  email,
  password,
  firstName,
  lastName,
  phoneNumber
) {
  try {
    console.log("🍪 Simple Admin Creation Mode");
    console.log("============================");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Validate inputs
    if (!validateEmail(email)) {
      throw new Error("Invalid email format");
    }

    const firstNameValidation = validateName(firstName, "First name");
    if (!firstNameValidation.valid) {
      throw new Error(firstNameValidation.message);
    }

    const lastNameValidation = validateName(lastName, "Last name");
    if (!lastNameValidation.valid) {
      throw new Error(lastNameValidation.message);
    }

    const phoneValidation = validatePhone(phoneNumber);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.message);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // Check for existing users
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phoneNumber: phoneNumber.trim() },
      ],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new Error("Email already exists");
      } else {
        throw new Error("Phone number already exists");
      }
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);

    const adminUser = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
      isFirstLogin: true,
      isActive: true,
    });

    await adminUser.save();

    console.log("✅ Admin user created successfully!");
    console.log(`👤 Name: ${adminUser.firstName} ${adminUser.lastName}`);
    console.log(`📧 Email: ${adminUser.email}`);
    console.log(`📞 Phone: ${adminUser.phoneNumber}`);
    console.log(`🆔 ID: ${adminUser._id}`);

    return adminUser;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("🔌 Disconnected from MongoDB");
    }
  }
}

// Handle process termination gracefully
process.on("SIGINT", async () => {
  console.log("\n\n👋 Goodbye!");
  rl.close();
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n\n🛑 Process terminated");
  rl.close();
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

// Display help information
function showHelp() {
  console.log("🍪 Cookie Cutter Order Management - Admin User Creation Script");
  console.log("==============================================================");
  console.log("");
  console.log(
    "This script creates an initial admin user for the Cookie Cutter Order Management System."
  );
  console.log("");
  console.log("Prerequisites:");
  console.log("  1. MongoDB must be running (local or Atlas)");
  console.log("  2. Backend .env file must be configured with MONGODB_URI");
  console.log("  3. Run this script from the project root directory");
  console.log("");
  console.log("Required Information:");
  console.log("  • First Name (2-50 characters)");
  console.log("  • Last Name (2-50 characters)");
  console.log("  • Email Address (must be unique and valid)");
  console.log("  • Phone Number (10-15 digits, must be unique)");
  console.log("  • Password (minimum 6 characters)");
  console.log("");
  console.log("Usage:");
  console.log(
    "  node create-admin.js                                    Interactive mode"
  );
  console.log(
    "  node create-admin.js email pass first last phone       Simple mode"
  );
  console.log(
    "  node create-admin.js --help                             Show this help"
  );
  console.log("");
  console.log("Examples:");
  console.log("  node create-admin.js");
  console.log(
    "  node create-admin.js admin@example.com pass123 John Doe 5551234567"
  );
  console.log("");
  console.log("Security Notes:");
  console.log(
    "  • Passwords are visible on screen for reliability (no hidden input)"
  );
  console.log("  • Admin will be required to change password on first login");
  console.log("  • Email and phone number must be unique in the system");
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  showHelp();
  process.exit(0);
} else if (args.length === 5) {
  // Simple mode with all arguments
  const [email, password, firstName, lastName, phoneNumber] = args;

  createSimpleAdmin(email, password, firstName, lastName, phoneNumber)
    .then(() => {
      console.log("\n🎉 Admin creation completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Error:", error.message);
      process.exit(1);
    });
} else if (args.length > 0) {
  console.log("❌ Invalid arguments provided.");
  console.log("\nUsage:");
  console.log("  Interactive mode: node create-admin.js");
  console.log(
    "  Simple mode:      node create-admin.js email password firstName lastName phoneNumber"
  );
  console.log("  Help:             node create-admin.js --help");
  process.exit(1);
} else {
  // Run interactive mode
  createAdminUser();
}

module.exports = {
  createAdminUser,
  createSimpleAdmin,
  validateEmail,
  validateName,
  validatePhone,
  validatePassword,
};
