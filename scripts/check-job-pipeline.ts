import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import { Job } from '../src/models/Job';
import { Pipeline } from '../src/models/Pipeline';
import { Candidate } from '../src/models/Candidate';

const checkJobPipeline = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ats';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get all jobs with their pipeline info
    const jobs = await Job.find({})
      .select('title pipelineId')
      .limit(10);

    console.log('\n=== JOBS AND PIPELINES ===\n');

    for (const job of jobs) {
      console.log(`Job: ${job.title}`);
      console.log(`  ID: ${job._id}`);
      
      if (job.pipelineId) {
        const pipeline = await Pipeline.findById(job.pipelineId);
        if (pipeline) {
          console.log(`  ✅ Pipeline: ${pipeline.name} (${pipeline._id})`);
          console.log(`  Stages (${pipeline.stages.length}):`);
          
          // Sort stages by order
          const sortedStages = pipeline.stages.sort((a: any, b: any) => a.order - b.order);
          sortedStages.forEach((stage: any, index: number) => {
            const marker = index === 0 ? '👉 FIRST' : '  ';
            console.log(`    ${marker} ${stage.order}. ${stage.name} (${stage._id})`);
          });
        } else {
          console.log(`  ❌ Pipeline ID exists but pipeline not found: ${job.pipelineId}`);
        }
      } else {
        console.log('  ⚠️  NO PIPELINE ASSIGNED');
      }
      console.log('');
    }

    // Check candidates
    const candidates = await Candidate.find({})
      .select('firstName lastName email jobIds currentPipelineStageId')
      .limit(5);

    console.log('\n=== RECENT CANDIDATES ===\n');
    for (const candidate of candidates) {
      console.log(`Candidate: ${candidate.firstName} ${candidate.lastName} (${candidate.email})`);
      console.log(`  ID: ${candidate._id}`);
      console.log(`  Job IDs: ${candidate.jobIds}`);
      console.log(`  Current Stage ID: ${candidate.currentPipelineStageId || 'NOT ASSIGNED'}`);
      
      if (candidate.currentPipelineStageId) {
        // Try to find which pipeline has this stage
        const pipelines = await Pipeline.find({
          'stages._id': candidate.currentPipelineStageId
        });
        
        if (pipelines.length > 0) {
          const pipeline = pipelines[0];
          const stage = pipeline.stages.find((s: any) => 
            s._id.toString() === candidate.currentPipelineStageId?.toString()
          );
          console.log(`  ✅ In Pipeline: ${pipeline.name}`);
          console.log(`  ✅ Stage: ${stage?.name} (order ${stage?.order})`);
        }
      }
      console.log('');
    }

    console.log('\n=========================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkJobPipeline();
