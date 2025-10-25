import { Request, Response } from 'express';
import { Category } from '../models';
import { asyncHandler, successResponse } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { CreateCategoryInput, UpdateCategoryInput } from '../types/category.types';

export const createCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateCategoryInput = req.body;

    const existingCategory = await Category.findOne({ name: data.name });
    if (existingCategory) {
      throw new CustomValidationError(`Category already exists with name: ${data.name}`);
    }

    const category = await Category.create({ ...data, createdBy: req.user?._id });
    logger.info(`Category created: ${category.name}`);
    successResponse(res, category, 'Category created successfully', 201);
  }
);

export const getCategories = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const categories = await Category.find().sort({ name: 1 });
    successResponse(res, categories, 'Categories retrieved successfully');
  }
);

export const getCategoryById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const category = await Category.findById(req.params.id);
    if (!category) throw new NotFoundError('Category not found');
    successResponse(res, category, 'Category retrieved successfully');
  }
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const updates: UpdateCategoryInput = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) throw new NotFoundError('Category not found');

    if (updates.name && updates.name !== category.name) {
      const existing = await Category.findOne({ name: updates.name, _id: { $ne: req.params.id } });
      if (existing) {
        throw new CustomValidationError(`Category already exists with name: ${updates.name}`);
      }
    }

    Object.assign(category, updates);
    category.updatedBy = req.user?._id as any;
    await category.save();

    logger.info(`Category updated: ${category.name}`);
    successResponse(res, category, 'Category updated successfully');
  }
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const category = await Category.findById(req.params.id);
    if (!category) throw new NotFoundError('Category not found');

    await category.deleteOne();
    logger.info(`Category deleted: ${category.name}`);
    successResponse(res, null, 'Category deleted successfully');
  }
);
