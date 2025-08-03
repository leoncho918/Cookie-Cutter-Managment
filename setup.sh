#!/bin/bash
# setup.sh - Automated setup script for Cookie Cutter Order Management System

echo "🍪 Cookie Cutter Order Management System Setup"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js v16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if MongoDB is running (optional, can use Atlas)
if command -v mongosh &> /dev/null; then
    echo "✅ MongoDB CLI detected"
else
    echo "⚠️  MongoDB CLI not found. You can use MongoDB Atlas instead."
fi

# Create project structure
echo "📁 Creating project structure..."
mkdir -p cookie-cutter-orders/backend/{models,routes,middleware,utils}
mkdir -p cookie-cutter-orders/frontend/src/{components/{Auth,Layout,UI,Dashboard,Orders,Admin},contexts,hooks,utils}

cd cookie-cutter-orders

# Backend setup
echo "🔧 Setting up backend..."
cd backend

# Initialize package.json
cat > package.json << 'EOF'
{
  "name": "cookie-cutter-backend",
  "version": "1.0.0",
  "description": "Cookie Cutter Order Management System - Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.4",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.32.5",
    "aws-sdk": "^2.1440.0",
    "uuid": "^9.0.0",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.4",
    "supertest": "^6.3.3",
    "eslint": "^8.48.0"
  }
}
EOF

# Create .env template
cat > .env << 'EOF'
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/cookie-cutter-orders

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key-make-this-very-long-and-random-123456789

# Email Configuration (UPDATE THESE!)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# AWS S3 Configuration (UPDATE THESE!)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=cookie-cutter-images
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.DS_Store
logs/
*.log
coverage/
dist/
build/
uploads/
EOF

echo "📦 Installing backend dependencies..."
npm install

# Frontend setup
echo "🎨 Setting up frontend..."
cd ../frontend

# Create React app files structure (simulate create-react-app)
cat > package.json << 'EOF'
{
  "name": "cookie-cutter-frontend",
  "version": "0.1.0",
  "private": true,
  "proxy": "http://localhost:5000",
  "dependencies": {
    "@testing-library/jest-dom": "^5.17.0",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^14.4.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.15.0",
    "react-scripts": "5.0.1",
    "axios": "^1.5.0",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "tailwindcss": "^3.3.3",
    "autoprefixer": "^10.4.15",
    "postcss": "^8.4.29"
  }
}
EOF

# Create basic React files
mkdir -p public src

cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Cookie Cutter Order Management System" />
    <title>Cookie Cutter Orders</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# Create Tailwind config
cat > tailwind.config.js << 'EOF'
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-gray-50', 'bg-gray-100', 'text-gray-600', 'text-gray-700', 'text-gray-800', 'text-gray-900',
    'bg-blue-50', 'bg-blue-100', 'text-blue-600', 'text-blue-700', 'text-blue-800',
    'bg-green-50', 'bg-green-100', 'text-green-600', 'text-green-700', 'text-green-800',
    'bg-yellow-50', 'bg-yellow-100', 'text-yellow-600', 'text-yellow-700', 'text-yellow-800',
    'bg-red-50', 'bg-red-100', 'text-red-600', 'text-red-700', 'text-red-800',
    'bg-purple-50', 'bg-purple-100', 'text-purple-600', 'text-purple-700', 'text-purple-800',
    'bg-indigo-50', 'bg-indigo-100', 'text-indigo-600', 'text-indigo-700', 'text-indigo-800',
    'bg-pink-50', 'bg-pink-100', 'text-pink-600', 'text-pink-700', 'text-pink-800',
    'bg-orange-50', 'bg-orange-100', 'text-orange-600', 'text-orange-700', 'text-orange-800',
  ]
}
EOF

cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

cat > src/App.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

.App {
  min-height: 100vh;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
EOF

# Create frontend .env
cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
EOF

echo "📦 Installing frontend dependencies..."
npm install

cd ..

echo ""
echo "🎉 Project structure created successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Copy all the code files from the artifacts into their respective folders"
echo "2. Update the .env files with your actual credentials:"
echo "   - MongoDB connection string"
echo "   - Email service credentials"
echo "   - AWS S3 credentials"
echo "3. Create the initial admin user in MongoDB"
echo "4. Start the servers:"
echo ""
echo "   Backend:  cd backend && npm run dev"
echo "   Frontend: cd frontend && npm start"
echo ""
echo "📁 Project structure:"
echo "cookie-cutter-orders/"
echo "├── backend/          (Node.js/Express API)"
echo "│   ├── models/       (MongoDB schemas)"
echo "│   ├── routes/       (API endpoints)"
echo "│   ├── middleware/   (Authentication)"
echo "│   ├── utils/        (Helper functions)"
echo "│   ├── .env          (⚠️  Update with your credentials)"
echo "│   └── package.json"
echo "├── frontend/         (React app)"
echo "│   ├── src/"
echo "│   │   ├── components/"
echo "│   │   ├── contexts/"
echo "│   │   ├── hooks/"
echo "│   │   └── utils/"
echo "│   ├── .env          (⚠️  Update API URL if needed)"
echo "│   └── package.json"
echo "└── README.md"
echo ""
echo "⚠️  IMPORTANT: Remember to update the .env files before starting!"

# Windows batch file version
cat > setup.bat << 'EOF'
@echo off
echo 🍪 Cookie Cutter Order Management System Setup (Windows)
echo ==================================================

REM Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js v16+ from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected

REM Create project structure
echo 📁 Creating project structure...
mkdir cookie-cutter-orders\backend\models
mkdir cookie-cutter-orders\backend\routes  
mkdir cookie-cutter-orders\backend\middleware
mkdir cookie-cutter-orders\backend\utils
mkdir cookie-cutter-orders\frontend\src\components\Auth
mkdir cookie-cutter-orders\frontend\src\components\Layout
mkdir cookie-cutter-orders\frontend\src\components\UI
mkdir cookie-cutter-orders\frontend\src\components\Dashboard
mkdir cookie-cutter-orders\frontend\src\components\Orders
mkdir cookie-cutter-orders\frontend\src\components\Admin
mkdir cookie-cutter-orders\frontend\src\contexts
mkdir cookie-cutter-orders\frontend\src\hooks
mkdir cookie-cutter-orders\frontend\src\utils

cd cookie-cutter-orders

echo 🔧 Setting up backend...
cd backend
npm init -y
npm install express mongoose cors dotenv bcryptjs jsonwebtoken nodemailer multer sharp aws-sdk uuid helmet express-rate-limit compression
npm install --save-dev nodemon jest supertest eslint

echo 🎨 Setting up frontend...
cd ..\frontend
npm init -y
npm install react react-dom react-router-dom axios react-scripts
npm install --save-dev tailwindcss autoprefixer postcss

cd ..

echo 🎉 Setup complete! Follow the manual steps in the guide to finish configuration.
pause
EOF

chmod +x setup.sh
chmod +x setup.bat

echo ""
echo "✨ Setup scripts created:"
echo "   - setup.sh (Linux/macOS)"
echo "   - setup.bat (Windows)"

# Create admin user script
cat > create-admin.js << 'EOF'
// create-admin.js - Script to create initial admin user
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    role: String,
    isFirstLogin: Boolean,
    isActive: Boolean,
    createdAt: Date,
    updatedAt: Date
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@cookiecutter.com' });
        if (existingAdmin) {
            console.log('❌ Admin user already exists!');
            process.exit(0);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Create admin user
        const admin = new User({
            email: 'admin@cookiecutter.com',
            password: hashedPassword,
            role: 'admin',
            isFirstLogin: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await admin.save();
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@cookiecutter.com');
        console.log('🔑 Password: admin123');
        console.log('⚠️  Please change the password after first login!');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createAdmin();
EOF

echo "👤 Admin creation script: create-admin.js"
echo "   Run with: cd backend && node ../create-admin.js"