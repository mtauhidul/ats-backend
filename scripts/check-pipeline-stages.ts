import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function checkPipelineStages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Define Pipeline schema inline
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
    
    // Find all pipelines
    const allPipelines = await Pipeline.find({});
    console.log(`📋 Found ${allPipelines.length} pipeline(s)\n`);
    
    if (allPipelines.length === 0) {
      console.log('❌ No pipelines found');
      return;
    }

    // Use the pipeline with ID 68ffce146e2a916f5505ea47 (from job check)
    const pipeline = await Pipeline.findById('68ffce146e2a916f5505ea47');
    
    if (!pipeline) {
      console.log('❌ No default pipeline found');
      return;
    }

    console.log('📋 Default Pipeline:', pipeline.name);
    console.log('Pipeline ID:', pipeline._id);
    console.log('\n🎯 Pipeline Stages:');
    console.log('='.repeat(60));
    
    // Sort stages by order
    const sortedStages = pipeline.stages.sort((a: any, b: any) => a.order - b.order);
    
    sortedStages.forEach((stage: any, index: number) => {
      console.log(`\n${index + 1}. Stage Name: "${stage.name}"`);
      console.log(`   Stage ID: ${stage._id}`);
      console.log(`   Order: ${stage.order}`);
      console.log(`   Color: ${stage.color}`);
      console.log(`   Description: ${stage.description || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkPipelineStages();
