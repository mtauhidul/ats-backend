import { Request, Response } from 'express';
import { EmailAccount } from '../models';
import imapService from '../services/imap.service';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreateEmailAccountInput,
  UpdateEmailAccountInput,
  ListEmailAccountsQuery,
} from '../types/emailAccount.types';

/**
 * Create new email account
 */
export const createEmailAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateEmailAccountInput = req.body;

    logger.info(`Creating email account for: ${data.email}`);
    
    // Check if email account already exists
    const existingAccount = await EmailAccount.findOne({ email: data.email });
    logger.info(`Existing account check result:`, existingAccount);
    
    if (existingAccount) {
      throw new CustomValidationError('Email account already exists');
    }

    // Create email account (password will be auto-encrypted by pre-save hook)
    const emailAccount = await EmailAccount.create({
      ...data,
      createdBy: req.userId,
    });

    logger.info(`Email account created: ${emailAccount.email} by user ${req.userId}`);

    successResponse(res, emailAccount, 'Email account created successfully', 201);
  }
);

/**
 * Get all email accounts
 */
export const getEmailAccounts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, provider, isActive, search } = req.query as any as ListEmailAccountsQuery;

    // Build filter
    const filter: any = {};
    if (provider) filter.provider = provider;
    if (isActive !== undefined) filter.isActive = isActive;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalCount = await EmailAccount.countDocuments(filter);

    // Calculate pagination
    const pagination = paginateResults(totalCount, { page, limit, sort: 'createdAt', order: 'desc' });

    // Calculate skip
    const skip = (page - 1) * limit;

    // Fetch data
    const emailAccounts = await EmailAccount.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        emailAccounts,
        pagination,
      },
      'Email accounts retrieved successfully'
    );
  }
);

/**
 * Get single email account
 */
export const getEmailAccountById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const emailAccount = await EmailAccount.findById(id).populate('createdBy', 'firstName lastName email');

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    successResponse(res, emailAccount, 'Email account retrieved successfully');
  }
);

/**
 * Update email account
 */
export const updateEmailAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateEmailAccountInput = req.body;

    const emailAccount = await EmailAccount.findById(id);

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    // Check if email is being changed and if it already exists
    if (updates.email && updates.email !== emailAccount.email) {
      const existingAccount = await EmailAccount.findOne({ email: updates.email });
      if (existingAccount) {
        throw new CustomValidationError('Email account already exists');
      }
    }

    // Update fields
    Object.assign(emailAccount, updates);
    await emailAccount.save();

    logger.info(`Email account updated: ${emailAccount.email} by user ${req.userId}`);

    successResponse(res, emailAccount, 'Email account updated successfully');
  }
);

/**
 * Delete email account
 */
export const deleteEmailAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const emailAccount = await EmailAccount.findById(id);

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    await emailAccount.deleteOne();

    logger.info(`Email account deleted: ${emailAccount.email} by user ${req.userId}`);

    successResponse(res, null, 'Email account deleted successfully');
  }
);

/**
 * Test email account connection
 */
export const testEmailAccountConnection = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const emailAccount = await EmailAccount.findById(id);

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    // Test IMAP connection
    const isConnected = await imapService.testConnection(emailAccount);

    if (!isConnected) {
      throw new CustomValidationError('Failed to connect to email account. Please check credentials.');
    }

    // Update last checked timestamp
    emailAccount.lastChecked = new Date();
    await emailAccount.save();

    logger.info(`Email account connection tested: ${emailAccount.email}`);

    successResponse(res, { connected: true }, 'Email account connection successful');
  }
);
