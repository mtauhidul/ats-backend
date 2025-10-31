import mongoose from 'mongoose';
import { config } from './src/config';
import EmailAccount from './src/models/emailAccount.model';

async function checkAccounts() {
  try {
    await mongoose.connect(config.database.uri);
    console.log('✅ Connected to database');

    const accounts = await EmailAccount.find({}).select('email lastChecked autoProcessResumes isActive');
    
    console.log('\n📧 Email Accounts:');
    accounts.forEach(account => {
      console.log(`  - ${account.email}`);
      console.log(`    Active: ${account.isActive}`);
      console.log(`    Auto Process: ${account.autoProcessResumes}`);
      console.log(`    Last Checked: ${account.lastChecked || 'Never'}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAccounts();
