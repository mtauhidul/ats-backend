import { getFirestoreDB } from '../src/config/firebase';

async function auditClients() {
  try {
    console.log('🔍 Starting Clients Audit...\n');
    
    const db = getFirestoreDB();
    const clientsRef = db.collection('clients'); // Clients are at root level
    const snapshot = await clientsRef.get();
    
    console.log(`📊 Total clients: ${snapshot.size}\n`);
    
    let validClients = 0;
    const issues: any[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const clientIssues: string[] = [];
      
      // Check required fields
      if (!data.id) clientIssues.push('Missing id field');
      if (!data.companyName) clientIssues.push('Missing companyName');
      if (!data.email) clientIssues.push('Missing email');
      if (!data.phone) clientIssues.push('Missing phone');
      if (!data.industry) clientIssues.push('Missing industry');
      if (!data.companySize) clientIssues.push('Missing companySize');
      
      // Check timestamp fields
      if (!data.createdAt) {
        clientIssues.push('Missing createdAt');
      } else if (typeof data.createdAt === 'object' && Object.keys(data.createdAt).length === 0) {
        clientIssues.push('createdAt is empty object {}');
      }
      
      if (!data.updatedAt) {
        clientIssues.push('Missing updatedAt');
      } else if (typeof data.updatedAt === 'object' && Object.keys(data.updatedAt).length === 0) {
        clientIssues.push('updatedAt is empty object {}');
      }
      
      // Check address structure
      if (data.address) {
        if (!data.address.city) clientIssues.push('address.city missing');
        if (!data.address.country) clientIssues.push('address.country missing');
      } else {
        clientIssues.push('Missing address object');
      }
      
      // Check contacts array
      if (!data.contacts || !Array.isArray(data.contacts)) {
        clientIssues.push('Missing or invalid contacts array');
      } else if (data.contacts.length === 0) {
        clientIssues.push('Empty contacts array');
      } else {
        // Check each contact
        data.contacts.forEach((contact: any, idx: number) => {
          if (!contact.name) clientIssues.push(`contacts[${idx}].name missing`);
          if (!contact.email) clientIssues.push(`contacts[${idx}].email missing`);
          if (!contact.position) clientIssues.push(`contacts[${idx}].position missing`);
          if (typeof contact.isPrimary !== 'boolean') clientIssues.push(`contacts[${idx}].isPrimary not boolean`);
        });
        
        // Check if there's exactly one primary contact
        const primaryContacts = data.contacts.filter((c: any) => c.isPrimary);
        if (primaryContacts.length === 0) {
          clientIssues.push('No primary contact found');
        } else if (primaryContacts.length > 1) {
          clientIssues.push(`Multiple primary contacts (${primaryContacts.length})`);
        }
      }
      
      // Check logo field if exists
      if (data.logo) {
        const isValidUrl = data.logo.startsWith('http://') || 
                          data.logo.startsWith('https://') || 
                          data.logo.startsWith('data:');
        if (!isValidUrl) {
          clientIssues.push('Invalid logo format (not URL or data URL)');
        }
      }
      
      // Check status
      const validStatuses = ['active', 'inactive', 'pending', 'on_hold'];
      if (data.status && !validStatuses.includes(data.status)) {
        clientIssues.push(`Invalid status: ${data.status}`);
      }
      
      // Check industry enum
      const validIndustries = ['technology', 'healthcare', 'finance', 'education', 'retail', 
                               'manufacturing', 'consulting', 'real_estate', 'hospitality', 'other'];
      if (data.industry && !validIndustries.includes(data.industry)) {
        clientIssues.push(`Invalid industry: ${data.industry}`);
      }
      
      // Check companySize enum
      const validSizes = ['1-50', '51-200', '201-500', '500+'];
      if (data.companySize && !validSizes.includes(data.companySize)) {
        clientIssues.push(`Invalid companySize: ${data.companySize}`);
      }
      
      if (clientIssues.length === 0) {
        validClients++;
      } else {
        issues.push({
          id: doc.id,
          companyName: data.companyName || 'UNKNOWN',
          issues: clientIssues
        });
      }
    });
    
    console.log(`✅ Valid clients: ${validClients}`);
    console.log(`⚠️  Clients with issues: ${issues.length}\n`);
    
    if (issues.length > 0) {
      console.log('=' .repeat(60));
      console.log('ISSUES FOUND:');
      console.log('='.repeat(60));
      
      issues.forEach(issue => {
        console.log(`\nClient: ${issue.companyName} (${issue.id})`);
        issue.issues.forEach((msg: string) => {
          console.log(`  ❌ ${msg}`);
        });
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Audit complete!');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error during audit:', error);
    process.exit(1);
  }
}

auditClients();
