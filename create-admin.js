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
