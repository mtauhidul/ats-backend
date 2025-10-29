import { Request, Response } from 'express';
import { Pipeline } from '../models';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreatePipelineInput,
  UpdatePipelineInput,
  ListPipelinesQuery,
} from '../types/pipeline.types';

/**
 * Create new pipeline
 */
export const createPipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreatePipelineInput = req.body;

    // Check for duplicate pipeline name
    const existingPipeline = await Pipeline.findOne({ name: data.name });

    if (existingPipeline) {
      throw new CustomValidationError(
        `Pipeline already exists with name: ${data.name}`
      );
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await Pipeline.updateMany({}, { isDefault: false });
    }

    // Create pipeline
    const pipeline = await Pipeline.create({
      ...data,
      createdBy: req.user?._id,
    });

    logger.info(`Pipeline created: ${pipeline.name} by user ${req.user?._id}`);

    successResponse(res, pipeline, 'Pipeline created successfully', 201);
  }
);

/**
 * Get all pipelines with filters and pagination
 */
export const getPipelines = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any as ListPipelinesQuery;

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const totalCount = await Pipeline.countDocuments(filter);

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Calculate skip
    const skip = (page - 1) * limit;

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch data
    const pipelines = await Pipeline.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        pipelines,
        pagination,
      },
      'Pipelines retrieved successfully'
    );
  }
);

/**
 * Get single pipeline by ID
 */
export const getPipelineById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const pipeline = await Pipeline.findById(id)
      .populate('createdBy', 'firstName lastName email');

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Get job count using this pipeline
    const Job = require('../models').Job;
    const jobCount = await Job.countDocuments({ pipelineId: id });

    successResponse(
      res,
      {
        ...pipeline.toJSON(),
        jobCount,
      },
      'Pipeline retrieved successfully'
    );
  }
);

/**
 * Update pipeline
 */
export const updatePipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdatePipelineInput = req.body;

    const pipeline = await Pipeline.findById(id);

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Check if name is being changed and if it creates a duplicate
    if (updates.name && updates.name !== pipeline.name) {
      const existingPipeline = await Pipeline.findOne({
        name: updates.name,
        _id: { $ne: id },
      });

      if (existingPipeline) {
        throw new CustomValidationError(
          `Pipeline already exists with name: ${updates.name}`
        );
      }
    }

    // If this is being set as default, unset other defaults
    if (updates.isDefault) {
      await Pipeline.updateMany({ _id: { $ne: id } }, { isDefault: false });
    }

    // Handle stages update specially to preserve existing stage IDs
    if (updates.stages && Array.isArray(updates.stages)) {
      const existingStages = pipeline.stages;
      const updatedStages = updates.stages.map((newStage: any, index: number) => {
        // If the stage has an _id, try to find and update the existing stage
        if (newStage._id) {
          const existingStage = existingStages.find((s: any) => 
            s._id.toString() === newStage._id.toString()
          );
          if (existingStage) {
            // Preserve the existing _id and update other fields
            return {
              _id: existingStage._id,
              name: newStage.name,
              description: newStage.description,
              order: newStage.order !== undefined ? newStage.order : index,
              color: newStage.color,
              isActive: newStage.isActive !== undefined ? newStage.isActive : true,
            };
          }
        }
        // For stages without _id or not found, check if we can match by order/index
        const existingStageByOrder = existingStages[index];
        if (existingStageByOrder) {
          // Preserve existing stage ID when updating by position
          return {
            _id: existingStageByOrder._id,
            name: newStage.name,
            description: newStage.description,
            order: newStage.order !== undefined ? newStage.order : index,
            color: newStage.color,
            isActive: newStage.isActive !== undefined ? newStage.isActive : true,
          };
        }
        // New stage without matching existing one
        return newStage;
      });
      
      // Remove stages from updates and update manually
      delete updates.stages;
      pipeline.stages = updatedStages as any;
    }

    // Update other fields
    Object.assign(pipeline, updates);
    pipeline.updatedBy = req.user?._id as any;
    await pipeline.save();

    logger.info(`Pipeline updated: ${pipeline.name}`);

    successResponse(res, pipeline, 'Pipeline updated successfully');
  }
);

/**
 * Delete pipeline
 */
export const deletePipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const pipeline = await Pipeline.findById(id);

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Check if this is the default pipeline
    if (pipeline.isDefault) {
      throw new CustomValidationError(
        'Cannot delete the default pipeline. Please set another pipeline as default first.'
      );
    }

    // Check if there are jobs using this pipeline
    const Job = require('../models').Job;
    const jobCount = await Job.countDocuments({ pipelineId: id });

    if (jobCount > 0) {
      throw new CustomValidationError(
        `Cannot delete pipeline with ${jobCount} active jobs. Please reassign the jobs first.`
      );
    }

    await pipeline.deleteOne();

    logger.info(`Pipeline deleted: ${pipeline.name}`);

    successResponse(res, null, 'Pipeline deleted successfully');
  }
);

/**
 * Get default pipeline
 */
export const getDefaultPipeline = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const pipeline = await Pipeline.findOne({ isDefault: true });

    if (!pipeline) {
      throw new NotFoundError('No default pipeline found');
    }

    successResponse(res, pipeline, 'Default pipeline retrieved successfully');
  }
);
