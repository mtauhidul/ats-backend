import { tagService } from '../src/services/firestore';
import '../src/config/firebase';

const defaultTags = [
  { name: 'Frontend', color: '#3B82F6' },
  { name: 'Backend', color: '#10B981' },
  { name: 'Full Stack', color: '#8B5CF6' },
  { name: 'DevOps', color: '#F59E0B' },
  { name: 'UI/UX', color: '#EC4899' },
  { name: 'Mobile', color: '#06B6D4' },
  { name: 'Data Science', color: '#6366F1' },
  { name: 'Senior', color: '#EF4444' },
  { name: 'Junior', color: '#22C55E' },
  { name: 'Mid-Level', color: '#F97316' },
  { name: 'Remote', color: '#14B8A6' },
  { name: 'Onsite', color: '#A855F7' },
  { name: 'Contract', color: '#84CC16' },
  { name: 'Full-Time', color: '#0EA5E9' },
  { name: 'Part-Time', color: '#F43F5E' },
];

async function seedTags() {
  try {
    console.log('🌱 Starting to seed tags...');

    // Check if tags already exist
    const existingTags = await tagService.find([]);
    console.log(`📊 Found ${existingTags.length} existing tags`);

    for (const tagData of defaultTags) {
      const existing = existingTags.find((t: any) => t.name === tagData.name);
      
      if (!existing) {
        const tagId = await tagService.create(tagData as any);
        console.log(`✅ Created tag: ${tagData.name} (ID: ${tagId})`);
      } else {
        console.log(`⏭️  Tag already exists: ${tagData.name}`);
      }
    }

    console.log('✨ Tags seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding tags:', error);
    process.exit(1);
  }
}

seedTags();
