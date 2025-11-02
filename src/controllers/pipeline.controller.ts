import { Request, Response } from 'express';
import { pipelineService, jobService } from '../services/firestore';
import { asyncHandler, successResponse, paginateResults } from '../utils/helpers';
import { NotFoundError, ValidationError as CustomValidationError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import {
  CreatePipelineInput,
  ListPipelinesQuery,
} from '../types/pipeline.types';

/**
 * Create new pipeline
 */
export const createPipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreatePipelineInput = req.body;

    // Check for duplicate pipeline name
    const allPipelines = await pipelineService.find([]);
    const existingPipeline = allPipelines.find((p: any) => p.name === data.name);

    if (existingPipeline) {
      throw new CustomValidationError(
        `Pipeline already exists with name: ${data.name}`
      );
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await Promise.all(
        allPipelines.map((p: any) =>
          pipelineService.update(p.id, { isDefault: false } as any)
        )
      );
    }

    // Create pipeline
    const pipelineId = await pipelineService.create({
      ...data,
      createdBy: req.user?.id,
    } as any);

    const pipeline = await pipelineService.findById(pipelineId);

    logger.info(`Pipeline created: ${pipeline?.name} by user ${req.user?.id}`);

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

    // Get all pipelines
    let allPipelines = await pipelineService.find([]);

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allPipelines = allPipelines.filter((pipeline: any) =>
        pipeline.name?.toLowerCase().includes(searchLower) ||
        pipeline.description?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count after filtering
    const totalCount = allPipelines.length;

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Apply sorting
    allPipelines.sort((a: any, b: any) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const pipelines = allPipelines.slice(skip, skip + limit);

    // Ensure stages is an array for each pipeline (handle Firestore serialization)
    const pipelinesWithArrayStages = pipelines.map((pipeline: any) => {
      let stages = pipeline.stages;
      if (stages && !Array.isArray(stages) && typeof stages === 'object') {
        stages = Object.values(stages);
      }
      return {
        ...pipeline,
        stages,
      };
    });

    successResponse(
      res,
      {
        pipelines: pipelinesWithArrayStages,
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

    const pipeline = await pipelineService.findById(id);

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Get job count using this pipeline
    const allJobs = await jobService.find([]);
    const jobCount = allJobs.filter((job: any) => job.pipelineId === id).length;

    // Ensure stages is an array (handle Firestore serialization)
    let stages = (pipeline as any).stages;
    if (stages && !Array.isArray(stages) && typeof stages === 'object') {
      stages = Object.values(stages);
    }

    successResponse(
      res,
      {
        ...pipeline,
        stages,
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
    const data: any = req.body;

    const pipeline = await pipelineService.findById(id);

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Check for duplicate name if name is being updated
    if (data.name && data.name !== pipeline.name) {
      const allPipelines = await pipelineService.find([]);
      const existingPipeline = allPipelines.find(
        (p: any) => p.name === data.name && p.id !== id
      );

      if (existingPipeline) {
        throw new BadRequestError('Pipeline with this name already exists');
      }
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      const allPipelines = await pipelineService.find([]);
      await Promise.all(
        allPipelines
          .filter((p: any) => p.id !== id)
          .map((p: any) =>
            pipelineService.update(p.id, { isDefault: false } as any)
          )
      );
    }

    // Handle stages update with proper _id preservation
    if (data.stages) {
      const updatedStages = data.stages.map((stage: any, index: number) => {
        const existingStage: any = pipeline.stages?.[index];

        return {
          ...stage,
          // Preserve existing _id if the stage already exists
          _id: existingStage?._id || stage._id || undefined,
        };
      });

      data.stages = updatedStages;
    }

    // Update pipeline
    const updateData: any = {
      ...data,
      updatedBy: req.user?.id,
      updatedAt: new Date(),
    };

    await pipelineService.update(id, updateData);

    const updatedPipeline = await pipelineService.findById(id);

    successResponse(res, updatedPipeline, 'Pipeline updated successfully');
  }
);

/**
 * Delete pipeline
 */
export const deletePipeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const pipeline = await pipelineService.findById(id);

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
    const allJobs = await jobService.find([]);
    const jobCount = allJobs.filter((job: any) => job.pipelineId === id).length;

    if (jobCount > 0) {
      throw new CustomValidationError(
        `Cannot delete pipeline with ${jobCount} active jobs. Please reassign the jobs first.`
      );
    }

    await pipelineService.delete(id);

    logger.info(`Pipeline deleted: ${pipeline.name}`);

    successResponse(res, null, 'Pipeline deleted successfully');
  }
);

/**
 * Get default pipeline
 */
export const getDefaultPipeline = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const allPipelines = await pipelineService.find([]);
    const pipeline = allPipelines.find((p: any) => p.isDefault === true);

    if (!pipeline) {
      throw new NotFoundError('No default pipeline found');
    }

    successResponse(res, pipeline, 'Default pipeline retrieved successfully');
  }
);
