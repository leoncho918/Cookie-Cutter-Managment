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
