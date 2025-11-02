import { getFirestoreDB } from '../src/config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const seedCategories = async () => {
  const db = getFirestoreDB();
  const categoriesRef = db.collection('categories');

  const defaultCategories = [
    {
      name: 'Engineering',
      description: 'Software and hardware engineering positions',
      color: '#3B82F6',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Product',
      description: 'Product management and design roles',
      color: '#10B981',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Marketing',
      description: 'Marketing and growth positions',
      color: '#F59E0B',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Sales',
      description: 'Sales and business development roles',
      color: '#EF4444',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Design',
      description: 'UI/UX and graphic design positions',
      color: '#8B5CF6',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Operations',
      description: 'Operations and administrative roles',
      color: '#6366F1',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Finance',
      description: 'Finance and accounting positions',
      color: '#14B8A6',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      name: 'Customer Success',
      description: 'Customer support and success roles',
      color: '#EC4899',
      type: 'job',
      isActive: true,
      createdBy: 'system',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ];

  console.log('🌱 Seeding categories...');

  for (const category of defaultCategories) {
    // Check if category already exists
    const existingQuery = await categoriesRef
      .where('name', '==', category.name)
      .get();

    if (existingQuery.empty) {
      await categoriesRef.add(category);
      console.log(`✅ Created category: ${category.name}`);
    } else {
      console.log(`⏭️  Category already exists: ${category.name}`);
    }
  }

  console.log('✨ Category seeding complete!');
  process.exit(0);
};

seedCategories().catch((error) => {
  console.error('❌ Error seeding categories:', error);
  process.exit(1);
});
