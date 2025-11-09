/**
 * Seed Firestore with Test Data
 * Creates sample data in Firestore for testing realtime subscriptions
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase_config.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const companyId = process.env.DEFAULT_COMPANY_ID || 'default-company';

async function seedData() {
  console.log('🌱 Seeding Firestore with test data...\n');
  console.log(`📍 Company ID: ${companyId}\n`);

  try {
    // Seed Categories
    console.log('📦 Creating categories...');
    const categoriesRef = db.collection(`companies/${companyId}/categories`);
    const categoryDocs = [
      { name: 'Engineering', description: 'Software and technical roles', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Marketing', description: 'Marketing and growth roles', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Sales', description: 'Sales and business development', createdAt: new Date(), updatedAt: new Date() },
    ];
    for (const category of categoryDocs) {
      await categoriesRef.add(category);
    }
    console.log('   ✅ Created 3 categories\n');

    // Seed Tags
    console.log('📦 Creating tags...');
    const tagsRef = db.collection(`companies/${companyId}/tags`);
    const tagDocs = [
      { name: 'Remote', color: '#4CAF50', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Urgent', color: '#FF5252', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Senior', color: '#2196F3', createdAt: new Date(), updatedAt: new Date() },
    ];
    for (const tag of tagDocs) {
      await tagsRef.add(tag);
    }
    console.log('   ✅ Created 3 tags\n');

    // Seed Clients
    console.log('📦 Creating clients...');
    const clientsRef = db.collection(`companies/${companyId}/clients`);
    const clientDocs = [
      {
        name: 'Acme Corporation',
        email: 'contact@acme.com',
        contactPerson: 'John Doe',
        phone: '+1-555-0123',
        status: 'active',
        industry: 'Technology',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'TechStart Inc',
        email: 'hello@techstart.com',
        contactPerson: 'Jane Smith',
        phone: '+1-555-0456',
        status: 'active',
        industry: 'Startup',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];
    const clientIds = [];
    for (const client of clientDocs) {
      const docRef = await clientsRef.add(client);
      clientIds.push(docRef.id);
    }
    console.log('   ✅ Created 2 clients\n');

    // Seed Jobs
    console.log('📦 Creating jobs...');
    const jobsRef = db.collection(`companies/${companyId}/jobs`);
    const jobDocs = [
      {
        title: 'Senior Full Stack Engineer',
        description: 'We are looking for an experienced full-stack engineer to join our growing team. You will work on building scalable web applications using modern technologies.',
        status: 'open',
        jobType: 'full-time',
        workMode: 'remote',
        location: 'San Francisco, USA',
        salary: {
          min: 120000,
          max: 180000,
          currency: 'USD'
        },
        requirements: [
          '5+ years of experience in web development',
          'Strong knowledge of React and Node.js',
          'Experience with TypeScript',
          'Understanding of database design'
        ],
        skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
        clientId: clientIds[0],
        categoryIds: [],
        tagIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Product Designer',
        description: 'Join our design team to create beautiful and intuitive user experiences. You will work closely with engineers and product managers.',
        status: 'open',
        jobType: 'full-time',
        workMode: 'hybrid',
        location: 'New York, USA',
        salary: {
          min: 90000,
          max: 130000,
          currency: 'USD'
        },
        requirements: [
          '3+ years of product design experience',
          'Proficiency in Figma',
          'Strong portfolio',
          'Experience with design systems'
        ],
        skills: ['Figma', 'UI/UX', 'Design Systems', 'Prototyping'],
        clientId: clientIds[1],
        categoryIds: [],
        tagIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Marketing Manager',
        description: 'Lead our marketing efforts and help grow our brand. You will develop and execute marketing strategies across multiple channels.',
        status: 'open',
        jobType: 'full-time',
        workMode: 'onsite',
        location: 'Boston, USA',
        salary: {
          min: 80000,
          max: 110000,
          currency: 'USD'
        },
        requirements: [
          '4+ years marketing experience',
          'Experience with digital marketing',
          'Strong analytical skills',
          'Leadership experience'
        ],
        skills: ['SEO', 'Content Marketing', 'Analytics', 'Social Media'],
        clientId: clientIds[0],
        categoryIds: [],
        tagIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];
    const jobIds = [];
    for (const job of jobDocs) {
      const docRef = await jobsRef.add(job);
      jobIds.push(docRef.id);
    }
    console.log('   ✅ Created 3 jobs\n');

    // Seed Candidates
    console.log('📦 Creating candidates...');
    const candidatesRef = db.collection(`companies/${companyId}/candidates`);
    const candidateDocs = [
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
        phone: '+1-555-1111',
        resume: 'https://example.com/resumes/alice.pdf',
        status: 'active',
        skills: ['React', 'TypeScript', 'Node.js'],
        experience: '6 years',
        location: 'San Francisco, USA',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: 'Bob',
        lastName: 'Williams',
        email: 'bob.williams@example.com',
        phone: '+1-555-2222',
        resume: 'https://example.com/resumes/bob.pdf',
        status: 'active',
        skills: ['Figma', 'UI/UX', 'Design Systems'],
        experience: '4 years',
        location: 'New York, USA',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: 'Carol',
        lastName: 'Martinez',
        email: 'carol.martinez@example.com',
        phone: '+1-555-3333',
        resume: 'https://example.com/resumes/carol.pdf',
        status: 'active',
        skills: ['SEO', 'Content Marketing', 'Analytics'],
        experience: '5 years',
        location: 'Boston, USA',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];
    const candidateIds = [];
    for (const candidate of candidateDocs) {
      const docRef = await candidatesRef.add(candidate);
      candidateIds.push(docRef.id);
    }
    console.log('   ✅ Created 3 candidates\n');

    // Seed Applications
    console.log('📦 Creating applications...');
    const applicationsRef = db.collection(`companies/${companyId}/applications`);
    const applicationDocs = [
      {
        jobId: jobIds[0], // Senior Full Stack Engineer
        candidateId: candidateIds[0], // Alice
        status: 'applied',
        stage: 'screening',
        appliedAt: new Date(),
        notes: 'Strong technical background, matches all requirements',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        jobId: jobIds[1], // Product Designer
        candidateId: candidateIds[1], // Bob
        status: 'interview',
        stage: 'interview',
        appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: 'Excellent portfolio, scheduling final interview',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        jobId: jobIds[2], // Marketing Manager
        candidateId: candidateIds[2], // Carol
        status: 'applied',
        stage: 'screening',
        appliedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        notes: 'Good experience in digital marketing',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];
    for (const application of applicationDocs) {
      await applicationsRef.add(application);
    }
    console.log('   ✅ Created 3 applications\n');

    console.log('✅ Seeding complete!\n');
    console.log('📊 Summary:');
    console.log('   - 3 Categories');
    console.log('   - 3 Tags');
    console.log('   - 2 Clients');
    console.log('   - 3 Jobs');
    console.log('   - 3 Candidates');
    console.log('   - 3 Applications\n');
    console.log('🎉 Your Firestore database now has test data!');
    console.log('🚀 Open your dashboard to see realtime updates!\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedData().catch(console.error);
