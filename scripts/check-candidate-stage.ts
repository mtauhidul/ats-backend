import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function checkCandidateStage() {
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
    
    // Find Mir Islam
    const candidate = await Candidate.findOne({ 
      firstName: 'Mir',
      lastName: 'Islam'
    });
    
    if (!candidate) {
      console.log('❌ Candidate not found');
      return;
    }

    console.log('👤 Candidate:', candidate.firstName, candidate.lastName);
    console.log('📧 Email:', candidate.email);
    console.log('🆔 Candidate ID:', candidate._id);
    console.log('🎯 Current Pipeline Stage ID:', candidate.currentPipelineStageId);
    
    // Find the stage in the pipeline
    const pipeline = await Pipeline.findOne({
      'stages._id': candidate.currentPipelineStageId
    });
    
    if (pipeline) {
      console.log('\n📋 Pipeline:', pipeline.name);
      const stage = pipeline.stages.find((s: any) => 
        s._id.toString() === candidate.currentPipelineStageId.toString()
      );
      
      if (stage) {
        console.log('✅ Stage Found:');
        console.log('   Name:', stage.name);
        console.log('   Order:', stage.order);
        console.log('   Color:', stage.color);
        console.log('   Description:', stage.description);
      } else {
        console.log('❌ Stage not found in pipeline stages array');
      }
    } else {
      console.log('❌ No pipeline found with this stage ID');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkCandidateStage();
