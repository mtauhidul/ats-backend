import { Request, Response } from 'express';
import { emailAccountService } from '../services/firestore';
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
    const allAccounts = await emailAccountService.find([]);
    const existingAccount = allAccounts.find((acc: any) => acc.email === data.email);
    logger.info(`Existing account check result:`, existingAccount);
    
    if (existingAccount) {
      throw new CustomValidationError('Email account already exists');
    }

    // Create email account (password will be auto-encrypted by pre-save hook)
    const accountId = await emailAccountService.create({
      ...data,
      createdBy: req.userId,
    } as any);

    const emailAccount = await emailAccountService.findById(accountId);

    logger.info(`Email account created: ${emailAccount?.email} by user ${req.userId}`);

    successResponse(res, emailAccount, 'Email account created successfully', 201);
  }
);

/**
 * Get all email accounts
 */
export const getEmailAccounts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, provider, isActive, search } = req.query as any as ListEmailAccountsQuery;

    // Get all accounts
    let allAccounts = await emailAccountService.find([]);

    // Apply filters
    if (provider) {
      allAccounts = allAccounts.filter((acc: any) => acc.provider === provider);
    }
    if (isActive !== undefined) {
      allAccounts = allAccounts.filter((acc: any) => acc.isActive === isActive);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      allAccounts = allAccounts.filter((acc: any) =>
        acc.name?.toLowerCase().includes(searchLower) ||
        acc.email?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count
    const totalCount = allAccounts.length;

    // Calculate pagination
    const pagination = paginateResults(totalCount, { page, limit, sort: 'createdAt', order: 'desc' });

    // Sort and paginate
    allAccounts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const skip = (page - 1) * limit;
    const emailAccounts = allAccounts.slice(skip, skip + limit);

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

    const emailAccount = await emailAccountService.findById(id);

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

    const emailAccount = await emailAccountService.findById(id);

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    // Check if email is being changed and if it already exists
    if (updates.email && updates.email !== emailAccount.email) {
      const allAccounts = await emailAccountService.find([]);
      const existingAccount = allAccounts.find((acc: any) => acc.email === updates.email);
      if (existingAccount) {
        throw new CustomValidationError('Email account already exists');
      }
    }

    // Update fields
    await emailAccountService.update(id, updates as any);

    const updatedAccount = await emailAccountService.findById(id);

    logger.info(`Email account updated: ${updatedAccount?.email} by user ${req.userId}`);

    successResponse(res, updatedAccount, 'Email account updated successfully');
  }
);

/**
 * Delete email account
 */
export const deleteEmailAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const emailAccount = await emailAccountService.findById(id);

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    await emailAccountService.delete(id);

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

    const emailAccount = await emailAccountService.findById(id);

    if (!emailAccount) {
      throw new NotFoundError('Email account not found');
    }

    // Test IMAP connection
    const isConnected = await imapService.testConnection(emailAccount as any);

    if (!isConnected) {
      throw new CustomValidationError('Failed to connect to email account. Please check credentials.');
    }

    // Update last checked timestamp
    await emailAccountService.update(id, { lastChecked: new Date() } as any);

    logger.info(`Email account connection tested: ${emailAccount.email}`);

    successResponse(res, { connected: true }, 'Email account connection successful');
  }
);
