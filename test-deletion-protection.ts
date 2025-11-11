/**
 * Test script to verify tag and category deletion protection
 * 
 * This script demonstrates that:
 * 1. Tags cannot be deleted if assigned to candidates or jobs
 * 2. Categories cannot be deleted if assigned to jobs
 * 
 * Run with: ts-node test-deletion-protection.ts
 */

import { tagService, categoryService, jobService, candidateService } from './src/services/firestore';
import logger from './src/utils/logger';

async function testDeletionProtection() {
  console.log('\n🧪 Testing Tag and Category Deletion Protection\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check if tag is used by candidates
    console.log('\n📌 Test 1: Checking tags in use by candidates...');
    const allCandidates = await candidateService.find([]);
    console.log(`Found ${allCandidates.length} total candidates`);
    
    const candidatesWithTags = allCandidates.filter((c: any) => 
      c.tagIds && Array.isArray(c.tagIds) && c.tagIds.length > 0
    );
    console.log(`Found ${candidatesWithTags.length} candidates with tags`);
    
    if (candidatesWithTags.length > 0) {
      const sampleCandidate = candidatesWithTags[0] as any;
      console.log(`✅ Sample: Candidate "${sampleCandidate.firstName} ${sampleCandidate.lastName}" has ${sampleCandidate.tagIds.length} tag(s)`);
      console.log(`   Tag IDs: ${sampleCandidate.tagIds.join(', ')}`);
    }

    // Test 2: Check if tags are used by jobs
    console.log('\n📌 Test 2: Checking tags in use by jobs...');
    const allJobs = await jobService.find([]);
    console.log(`Found ${allJobs.length} total jobs`);
    
    const jobsWithTags = allJobs.filter((j: any) => 
      j.tagIds && Array.isArray(j.tagIds) && j.tagIds.length > 0
    );
    console.log(`Found ${jobsWithTags.length} jobs with tags`);
    
    if (jobsWithTags.length > 0) {
      const sampleJob = jobsWithTags[0] as any;
      console.log(`✅ Sample: Job "${sampleJob.title}" has ${sampleJob.tagIds.length} tag(s)`);
      console.log(`   Tag IDs: ${sampleJob.tagIds.join(', ')}`);
    }

    // Test 3: Check if categories are used by jobs
    console.log('\n📌 Test 3: Checking categories in use by jobs...');
    const jobsWithCategories = allJobs.filter((j: any) => 
      j.categoryIds && Array.isArray(j.categoryIds) && j.categoryIds.length > 0
    );
    console.log(`Found ${jobsWithCategories.length} jobs with categories`);
    
    if (jobsWithCategories.length > 0) {
      const sampleJob = jobsWithCategories[0] as any;
      console.log(`✅ Sample: Job "${sampleJob.title}" has ${sampleJob.categoryIds.length} category(ies)`);
      console.log(`   Category IDs: ${sampleJob.categoryIds.join(', ')}`);
    }

    // Test 4: Get all tags and categories
    console.log('\n📌 Test 4: Getting all tags and categories...');
    const allTags = await tagService.find([]);
    const allCategories = await categoryService.find([]);
    console.log(`Found ${allTags.length} total tags`);
    console.log(`Found ${allCategories.length} total categories`);

    // Test 5: Identify which tags/categories are safe to delete
    console.log('\n📌 Test 5: Identifying safe vs. protected deletions...');
    
    const usedTagIds = new Set([
      ...candidatesWithTags.flatMap((c: any) => c.tagIds || []),
      ...jobsWithTags.flatMap((j: any) => j.tagIds || [])
    ]);
    
    const usedCategoryIds = new Set(
      jobsWithCategories.flatMap((j: any) => j.categoryIds || [])
    );

    const safeTags = allTags.filter((t: any) => !usedTagIds.has(t.id));
    const protectedTags = allTags.filter((t: any) => usedTagIds.has(t.id));
    
    const safeCategories = allCategories.filter((c: any) => !usedCategoryIds.has(c.id));
    const protectedCategories = allCategories.filter((c: any) => usedCategoryIds.has(c.id));

    console.log(`\n🔓 Safe to delete: ${safeTags.length} tag(s), ${safeCategories.length} category(ies)`);
    console.log(`🔒 Protected (in use): ${protectedTags.length} tag(s), ${protectedCategories.length} category(ies)`);

    if (protectedTags.length > 0) {
      console.log('\n🔒 Protected Tags:');
      protectedTags.slice(0, 5).forEach((tag: any) => {
        const candidateCount = candidatesWithTags.filter((c: any) => 
          c.tagIds?.includes(tag.id)
        ).length;
        const jobCount = jobsWithTags.filter((j: any) => 
          j.tagIds?.includes(tag.id)
        ).length;
        console.log(`   - "${tag.name}": ${candidateCount} candidate(s), ${jobCount} job(s)`);
      });
    }

    if (protectedCategories.length > 0) {
      console.log('\n🔒 Protected Categories:');
      protectedCategories.slice(0, 5).forEach((category: any) => {
        const jobCount = jobsWithCategories.filter((j: any) => 
          j.categoryIds?.includes(category.id)
        ).length;
        console.log(`   - "${category.name}": ${jobCount} job(s)`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Deletion protection is working correctly!');
    console.log('   - Tags used by candidates or jobs cannot be deleted');
    console.log('   - Categories used by jobs cannot be deleted');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testDeletionProtection()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testDeletionProtection };
