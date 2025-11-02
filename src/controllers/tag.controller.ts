import { Request, Response } from 'express';
import { tagService } from '../services/firestore';
import { asyncHandler, successResponse } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { CreateTagInput, UpdateTagInput } from '../types/tag.types';

export const createTag = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateTagInput = req.body;

    const allTags = await tagService.find([]);
    const existingTag = allTags.find((t: any) => t.name === data.name);
    if (existingTag) {
      throw new CustomValidationError(`Tag already exists with name: ${data.name}`);
    }

    const tagId = await tagService.create({ ...data, createdBy: req.user?.id } as any);
    const tag = await tagService.findById(tagId);
    if (!tag) throw new NotFoundError('Tag not found after creation');
    logger.info(`Tag created: ${tag.name}`);
    successResponse(res, tag, 'Tag created successfully', 201);
  }
);

export const getTags = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    let tags = await tagService.find([]);
    tags = tags.sort((a: any, b: any) => a.name.localeCompare(b.name));
    successResponse(res, tags, 'Tags retrieved successfully');
  }
);

export const getTagById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tag = await tagService.findById(req.params.id);
    if (!tag) throw new NotFoundError('Tag not found');
    successResponse(res, tag, 'Tag retrieved successfully');
  }
);

export const updateTag = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const updates: UpdateTagInput = req.body;
    const tag = await tagService.findById(req.params.id);

    if (!tag) throw new NotFoundError('Tag not found');

    if (updates.name && updates.name !== tag.name) {
      const allTags = await tagService.find([]);
      const existing = allTags.find(
        (t: any) => t.name === updates.name && t.id !== req.params.id
      );
      if (existing) {
        throw new CustomValidationError(`Tag already exists with name: ${updates.name}`);
      }
    }

    const updateData: any = {
      ...updates,
      updatedBy: req.user?.id,
      updatedAt: new Date(),
    };
    await tagService.update(req.params.id, updateData);

    const updatedTag = await tagService.findById(req.params.id);
    if (!updatedTag) throw new NotFoundError('Tag not found after update');
    logger.info(`Tag updated: ${updatedTag.name}`);
    successResponse(res, updatedTag, 'Tag updated successfully');
  }
);

export const deleteTag = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tag = await tagService.findById(req.params.id);
    if (!tag) throw new NotFoundError('Tag not found');

    await tagService.delete(req.params.id);
    logger.info(`Tag deleted: ${tag.name}`);
    successResponse(res, null, 'Tag deleted successfully');
  }
);
