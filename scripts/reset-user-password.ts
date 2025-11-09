import { getFirestoreDB } from '../src/config/firebase';
import { hashPassword } from '../src/utils/auth';

async function resetPassword() {
  try {
    const email = 'mislamtauhidul@gmail.com';
    const newPassword = process.argv[2] || 'Admin@123';
    
    console.log(`\nResetting password for: ${email}`);
    console.log(`New password: ${newPassword}\n`);
    
    const db = getFirestoreDB();
    
    // Find user
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase())
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ User not found');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update user
    await userDoc.ref.update({
      passwordHash,
      updatedAt: new Date(),
    });
    
    console.log('✅ Password updated successfully!');
    console.log(`\nYou can now login with:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

resetPassword();
