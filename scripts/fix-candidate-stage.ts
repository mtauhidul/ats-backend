import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function fixCandidateStage() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const candidateSchema = new mongoose.Schema({}, { strict: false });
    const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
    
    const pipelineStageSchema = new mongoose.Schema({
      name: String,
      description: String,
      color: String,
      order: Number,
    });

    const pipelineSchema = new mongoose.Schema({
      name: String,
      description: String,
      stages: [pipelineStageSchema],
      isDefault: Boolean,
      clientId: mongoose.Schema.Types.ObjectId,
    });

    const Pipeline = mongoose.models.Pipeline || mongoose.model('Pipeline', pipelineSchema);
    
    // Get the pipeline
    const pipeline = await Pipeline.findById('68ffce146e2a916f5505ea47');
    
    if (!pipeline) {
      console.log('❌ Pipeline not found');
      return;
    }

    // Get the first stage (sorted by order)
    const sortedStages = pipeline.stages.sort((a: any, b: any) => a.order - b.order);
    const firstStage = sortedStages[0];
    
    console.log('📋 Pipeline:', pipeline.name);
    console.log('🎯 First Stage:', firstStage.name);
    console.log('🆔 First Stage ID:', firstStage._id);
    
    // Find Mir Islam
    const candidate = await Candidate.findOne({ 
      firstName: 'Mir',
      lastName: 'Islam'
    });
    
    if (!candidate) {
      console.log('❌ Candidate not found');
      return;
    }

    console.log('\n👤 Candidate:', candidate.firstName, candidate.lastName);
    console.log('📧 Email:', candidate.email);
    console.log('🔴 Old Stage ID:', candidate.currentPipelineStageId);
    console.log('🟢 New Stage ID:', firstStage._id);
    
    // Update the candidate
    candidate.currentPipelineStageId = firstStage._id;
    await candidate.save();
    
    console.log('\n✅ Successfully updated candidate stage!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixCandidateStage();
