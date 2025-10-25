import { Request, Response } from 'express';
import { Tag } from '../models';
import { asyncHandler, successResponse } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { CreateTagInput, UpdateTagInput } from '../types/tag.types';

export const createTag = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateTagInput = req.body;

    const existingTag = await Tag.findOne({ name: data.name });
    if (existingTag) {
      throw new CustomValidationError(`Tag already exists with name: ${data.name}`);
    }

    const tag = await Tag.create({ ...data, createdBy: req.user?._id });
    logger.info(`Tag created: ${tag.name}`);
    successResponse(res, tag, 'Tag created successfully', 201);
  }
);

export const getTags = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const tags = await Tag.find().sort({ name: 1 });
    successResponse(res, tags, 'Tags retrieved successfully');
  }
);

export const getTagById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tag = await Tag.findById(req.params.id);
    if (!tag) throw new NotFoundError('Tag not found');
    successResponse(res, tag, 'Tag retrieved successfully');
  }
);

export const updateTag = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const updates: UpdateTagInput = req.body;
    const tag = await Tag.findById(req.params.id);

    if (!tag) throw new NotFoundError('Tag not found');

    if (updates.name && updates.name !== tag.name) {
      const existing = await Tag.findOne({ name: updates.name, _id: { $ne: req.params.id } });
      if (existing) {
        throw new CustomValidationError(`Tag already exists with name: ${updates.name}`);
      }
    }

    Object.assign(tag, updates);
    tag.updatedBy = req.user?._id as any;
    await tag.save();

    logger.info(`Tag updated: ${tag.name}`);
    successResponse(res, tag, 'Tag updated successfully');
  }
);

export const deleteTag = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tag = await Tag.findById(req.params.id);
    if (!tag) throw new NotFoundError('Tag not found');

    await tag.deleteOne();
    logger.info(`Tag deleted: ${tag.name}`);
    successResponse(res, null, 'Tag deleted successfully');
  }
);
