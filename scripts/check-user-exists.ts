import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkUser() {
  try {
    // Get MongoDB URI from environment or use default
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('MongoDB URI not found in environment variables');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Import User model
    const { User } = await import('../src/models/User');

    const userId = '68ff7ef139b908365e6055f3';

    console.log('=== CHECKING USER ===');
    console.log('Looking for user ID:', userId);
    
    const user = await User.findById(userId);
    
    if (user) {
      console.log('✅ User FOUND:');
      console.log('  Name:', user.firstName, user.lastName);
      console.log('  Email:', user.email);
      console.log('  Role:', user.role);
    } else {
      console.log('❌ User NOT FOUND');
      console.log('\nLet me list all users in the database:');
      
      const allUsers = await User.find().select('_id firstName lastName email role');
      console.log('\nAll Users:');
      allUsers.forEach((u, index) => {
        console.log(`${index + 1}. ID: ${u._id}`);
        console.log(`   Name: ${u.firstName} ${u.lastName}`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Role: ${u.role}\n`);
      });
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
