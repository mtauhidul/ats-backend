import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function testGetCandidates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const candidateSchema = new mongoose.Schema({}, { strict: false });
    const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);

    const candidates = await Candidate.find({})
      .populate({
        path: 'jobIds',
        select: 'title location employmentType'
      })
      .lean();

    console.log('📋 Found', candidates.length, 'candidate(s)\n');

    if (candidates.length > 0) {
      const candidate = candidates[0];
      console.log('👤 First Candidate:');
      console.log('   Name:', candidate.firstName, candidate.lastName);
      console.log('   Email:', candidate.email);
      console.log('   Current Stage ID:', candidate.currentPipelineStageId);
      console.log('   Job IDs populated?', Array.isArray(candidate.jobIds));
      
      if (candidate.jobIds && candidate.jobIds.length > 0) {
        console.log('\n📊 Job IDs:');
        candidate.jobIds.forEach((job: any, index: number) => {
          if (typeof job === 'object') {
            console.log(`   ${index + 1}. ${job.title || 'No title'} (ID: ${job._id})`);
          } else {
            console.log(`   ${index + 1}. Job ID: ${job} (Not populated)`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testGetCandidates();
