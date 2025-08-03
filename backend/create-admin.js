// create-admin.js - Script to create initial admin user
// Place this file in your project root directory (same level as backend folder)
// Run with: node create-admin.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
require("dotenv").config({ path: "../backend/.env" });

// User schema (matches your backend model)
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

// Global readline interface
let rl;

// Helper function to create fresh readline interface
const createReadlineInterface = () => {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
};

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    const interface = createReadlineInterface();
    interface.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

// Simplified password input function
const askPassword = (question) => {
  return new Promise((resolve) => {
    // Close any existing readline interface
    if (rl) {
      rl.close();
    }

    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let password = "";
    let isComplete = false;

    const onData = (char) => {
      if (isComplete) return;

      switch (char) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          isComplete = true;
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stdout.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          process.exit(1);
          break;
        case "\u007f": // Backspace
        case "\b": // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write("\b \b");
          }
          break;
        default:
          if (char.charCodeAt(0) >= 32) {
            // Printable characters only
            password += char;
            stdout.write("*");
          }
          break;
      }
    };

    stdin.on("data", onData);
  });
};

// Email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
      console.log(`   Email: ${existingAdmin.email}`);
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
        process.exit(0);
      }
      console.log("");
    }

    // Get admin details from user
    let email, password, confirmPassword;

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
    console.log(`   Email: ${email}`);
    console.log(`   Role: Admin`);
    console.log(`   First Login Required: ${isFirstLogin ? "Yes" : "No"}`);
    console.log("");

    const confirm = await askQuestion("Create this admin user? (Y/n): ");
    if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      console.log("Operation cancelled.");
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
      isFirstLogin: isFirstLogin,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await adminUser.save();

    console.log("\n🎉 Admin user created successfully!");
    console.log("=====================================");
    console.log(`📧 Email: ${adminUser.email}`);
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
  } catch (error) {
    console.error("\n❌ Error creating admin user:");

    if (error.code === 11000) {
      console.error("   Email address already exists in the database");
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
  } finally {
    if (rl) {
      rl.close();
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("\n🔌 Disconnected from MongoDB");
    }
    process.exit(0);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\n\n👋 Goodbye!");
  if (rl) {
    rl.close();
  }
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
  console.log("Usage:");
  console.log("  node create-admin.js         Create admin user interactively");
  console.log("  node create-admin.js --help  Show this help message");
  console.log("");
  console.log("Example:");
  console.log("  cd cookie-cutter-orders");
  console.log("  node create-admin.js");
  console.log("");
  console.log(
    "Note: If you experience issues with password input, try the simple version:"
  );
  console.log(
    "      node simple-create-admin.js admin@example.com password123"
  );
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  showHelp();
  process.exit(0);
}

// Run the script
if (require.main === module) {
  createAdminUser();
}
