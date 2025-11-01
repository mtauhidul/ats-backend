import mongoose from 'mongoose';
import { config } from '../config';
import { SystemSettings } from '../models/SystemSettings';
import logger from '../utils/logger';

/**
 * Migration Script: Initialize System Settings
 * 
 * This script creates the system settings document if it doesn't exist.
 * Run this once after deploying the new SystemSettings model.
 * 
 * Usage:
 *   npx ts-node src/scripts/init-system-settings.ts
 */

async function initializeSystemSettings() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    logger.info('✅ Connected to MongoDB');

    // Check if settings already exist
    const existingSettings = await SystemSettings.findOne({});
    
    if (existingSettings) {
      logger.info('✅ System settings already exist:');
      logger.info(`   Email Automation: ${existingSettings.emailAutomationEnabled ? 'ENABLED' : 'DISABLED'}`);
      logger.info(`   Last Updated: ${existingSettings.updatedAt}`);
    } else {
      // Create default settings
      logger.info('📝 Creating default system settings...');
      const settings = await SystemSettings.create({
        emailAutomationEnabled: false, // Disabled by default for safety
      });
      
      logger.info('✅ System settings created successfully:');
      logger.info(`   Email Automation: ${settings.emailAutomationEnabled ? 'ENABLED' : 'DISABLED'}`);
      logger.info(`   Created At: ${settings.createdAt}`);
      logger.info('');
      logger.info('📌 NOTE: Email automation is DISABLED by default.');
      logger.info('   You can enable it from the admin panel in the Email Monitoring Settings page.');
    }

    // Disconnect
    await mongoose.disconnect();
    logger.info('✅ Disconnected from MongoDB');
    logger.info('✅ Migration completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
initializeSystemSettings();
