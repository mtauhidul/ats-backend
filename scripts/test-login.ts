import { getFirestoreDB } from '../src/config/firebase';
import { comparePassword } from '../src/utils/auth';

async function testLogin() {
  try {
    const testEmail = 'mislamtauhidul@gmail.com';
    const testPassword = process.argv[2] || 'test123'; // Pass password as argument
    
    console.log(`\nTesting login for: ${testEmail}`);
    console.log(`Password: ${testPassword}\n`);
    
    const db = getFirestoreDB();
    
    // Find user
    const usersSnapshot = await db.collection('users')
      .where('email', '==', testEmail.toLowerCase())
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ User not found');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const user = userDoc.data();
    
    console.log('User found:');
    console.log('- ID:', userDoc.id);
    console.log('- Email:', user.email);
    console.log('- Is Active:', user.isActive);
    console.log('- Email Verified:', user.emailVerified);
    console.log('- Has Password Hash:', !!user.passwordHash);
    console.log('- Password Hash Length:', user.passwordHash?.length || 0);
    
    // Test password
    const isValid = await comparePassword(testPassword, user.passwordHash);
    console.log('\n✅ Password Match:', isValid);
    
    if (!isValid) {
      console.log('\n💡 Try running with: npx tsx scripts/test-login.ts <your-password>');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testLogin();
