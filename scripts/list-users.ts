import { getFirestoreDB } from '../src/config/firebase';

async function listUsers() {
  try {
    console.log('Fetching all users from Firestore...\n');
    
    const db = getFirestoreDB();
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in the database!');
      console.log('You need to create a user first.\n');
      return;
    }
    
    console.log(`✅ Found ${usersSnapshot.size} user(s):\n`);
    
    usersSnapshot.forEach((doc: any) => {
      const user = doc.data();
      console.log('-----------------------------------');
      console.log('ID:', doc.id);
      console.log('Email:', user.email);
      console.log('Name:', `${user.firstName} ${user.lastName}`);
      console.log('Role:', user.role);
      console.log('Is Active:', user.isActive);
      console.log('Email Verified:', user.emailVerified);
      console.log('Has Password:', !!user.passwordHash);
      console.log('-----------------------------------\n');
    });
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    process.exit(0);
  }
}

listUsers();
