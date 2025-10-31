const mongoose = require('mongoose');
require('dotenv').config();

async function analyzePerformance() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!\n');

    const db = mongoose.connection.db;

    // Check all collections
    console.log('=== DATABASE STATISTICS ===\n');
    const collections = await db.listCollections().toArray();

    for (const coll of collections) {
      const collName = coll.name;
      try {
        const count = await db.collection(collName).countDocuments();
        const stats = await db.collection(collName).stats();
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const avgDocSize = stats.avgObjSize ? (stats.avgObjSize / 1024).toFixed(2) : 'N/A';

        console.log(`📦 ${collName}`);
        console.log(`   Documents: ${count.toLocaleString()}`);
        console.log(`   Size: ${sizeMB} MB`);
        console.log(`   Avg doc size: ${avgDocSize} KB`);

        // Check indexes
        const indexes = await db.collection(collName).listIndexes().toArray();
        console.log(`   Indexes: ${indexes.length}`);
        indexes.forEach(idx => {
          console.log(`     - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        console.log('');
      } catch (err) {
        console.log(`   Error: ${err.message}\n`);
      }
    }

    // Specifically check messages
    console.log('\n=== MESSAGE COLLECTION ANALYSIS ===\n');
    const messageCollection = db.collection('messages');

    const totalMessages = await messageCollection.countDocuments();
    console.log(`Total messages: ${totalMessages.toLocaleString()}`);

    const internalMessages = await messageCollection.countDocuments({
      conversationId: { $exists: true, $ne: null },
      emailId: { $exists: false }
    });
    console.log(`Internal chat messages: ${internalMessages.toLocaleString()}`);

    const emailTracking = await messageCollection.countDocuments({
      emailId: { $exists: true }
    });
    console.log(`Email tracking records: ${emailTracking.toLocaleString()}`);

    const other = totalMessages - internalMessages - emailTracking;
    console.log(`Other records: ${other.toLocaleString()}`);

    // Check for slow queries
    console.log('\n=== TESTING QUERY PERFORMANCE ===\n');
    const testUserId = await db.collection('users').findOne({}, { projection: { _id: 1 } });

    if (testUserId) {
      console.log(`Testing with user ID: ${testUserId._id}`);

      // Test old query (slow)
      console.time('Old query (no filter)');
      await messageCollection.find({
        $or: [{ senderId: testUserId._id }, { recipientId: testUserId._id }],
      }).limit(100).toArray();
      console.timeEnd('Old query (no filter)');

      // Test new query (fast)
      console.time('New query (with filter)');
      await messageCollection.find({
        $or: [{ senderId: testUserId._id }, { recipientId: testUserId._id }],
        conversationId: { $exists: true, $ne: null },
        emailId: { $exists: false },
      }).limit(100).toArray();
      console.timeEnd('New query (with filter)');
    }

    await mongoose.disconnect();
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzePerformance();
