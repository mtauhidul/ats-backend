import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGetCandidateById() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ats';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Import Candidate model
    const { Candidate } = await import('../src/models/Candidate');

    const candidateId = '690232ab6c718f7573c63665';

    // Test 1: Get raw candidate without population
    console.log('\n=== TEST 1: Raw Candidate (No Population) ===');
    const rawCandidate = await Candidate.findById(candidateId);
    console.log('assignedTo field:', rawCandidate?.assignedTo);
    console.log('assignedTo type:', typeof rawCandidate?.assignedTo);

    // Test 2: Get candidate with population
    console.log('\n=== TEST 2: Populated Candidate ===');
    const populatedCandidate = await Candidate.findById(candidateId)
      .populate('assignedTo', 'firstName lastName email avatar');
    console.log('assignedTo field:', populatedCandidate?.assignedTo);
    console.log('Full candidate:', JSON.stringify(populatedCandidate, null, 2));

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testGetCandidateById();
