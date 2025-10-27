import { Request, Response } from "express";
import mongoose from "mongoose";
import { Job, Pipeline } from "../models";
import {
  BulkUpdateJobStatusInput,
  CreateJobInput,
  ListJobsQuery,
  UpdateJobInput,
} from "../types/job.types";
import {
  ValidationError as CustomValidationError,
  NotFoundError,
} from "../utils/errors";
import {
  asyncHandler,
  paginateResults,
  successResponse,
} from "../utils/helpers";
import logger from "../utils/logger";

/**
 * Create new job posting
 */
export const createJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateJobInput = req.body;

    // If pipelineId provided, verify it exists
    if (data.pipelineId) {
      const pipeline = await Pipeline.findById(data.pipelineId);
      if (!pipeline) {
        throw new NotFoundError("Pipeline not found");
      }
    }

    // Create job
    const job = await Job.create({
      ...data,
      createdBy: req.user?._id,
    });

    // Populate references
    await job.populate([
      { path: "clientId", select: "companyName logo" },
      { path: "pipelineId", select: "name stages" },
      { path: "categoryIds", select: "name" },
      { path: "tagIds", select: "name color" },
    ]);

    logger.info(`Job created: ${job.title} by user ${req.user?._id}`);

    successResponse(res, job, "Job created successfully", 201);
  }
);

/**
 * Get all jobs with filters and pagination
 */
export const getJobs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      clientId,
      status,
      employmentType,
      experienceLevel,
      isRemote,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as any as ListJobsQuery;

    // Build filter
    const filter: any = {};
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (employmentType) filter.employmentType = employmentType;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (isRemote !== undefined) filter.isRemote = isRemote;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const totalCount = await Job.countDocuments(filter);

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
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Fetch data
    const jobs = await Job.find(filter)
      .populate("clientId", "companyName logo")
      .populate("pipelineId", "name stages")
      .populate("categoryIds", "name")
      .populate("tagIds", "name color")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    successResponse(
      res,
      {
        jobs,
        pagination,
      },
      "Jobs retrieved successfully"
    );
  }
);

/**
 * Get single job by ID
 */
export const getJobById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const job = await Job.findById(id)
      .populate("clientId", "companyName logo website industry")
      .populate("pipelineId", "name stages")
      .populate("categoryIds", "name")
      .populate("tagIds", "name color")
      .populate("createdBy", "firstName lastName email");

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    // Get application count
    const Application = mongoose.model("Application");
    const applicationCount = await Application.countDocuments({ jobId: id });

    successResponse(
      res,
      {
        ...job.toJSON(),
        applicationCount,
      },
      "Job retrieved successfully"
    );
  }
);

/**
 * Update job
 */
export const updateJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateJobInput = req.body;

    logger.info(`=== Updating Job ${id} ===`);
    logger.info("Updates received:", JSON.stringify(updates, null, 2));
    logger.info("Requirements field:", updates.requirements);
    logger.info("Skills field:", updates.skills);

    // If pipelineId is being changed, verify it exists
    if (updates.pipelineId) {
      const pipeline = await Pipeline.findById(updates.pipelineId);
      if (!pipeline) {
        throw new NotFoundError("Pipeline not found");
      }
    }

    // Update job using findByIdAndUpdate with proper options
    const job = await Job.findByIdAndUpdate(
      id,
      {
        ...updates,
        updatedBy: req.user?._id,
      },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
      }
    ).populate([
      { path: "clientId", select: "name logo" },
      { path: "pipelineId", select: "name stages" },
      { path: "categoryIds", select: "name" },
      { path: "tagIds", select: "name color" },
    ]);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    logger.info(`Job updated: ${job.title}`);

    successResponse(res, job, "Job updated successfully");
  }
);

/**
 * Delete job
 */
export const deleteJob = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    // Check if there are applications
    const Application = mongoose.model("Application");
    const applicationCount = await Application.countDocuments({ jobId: id });

    if (applicationCount > 0) {
      throw new CustomValidationError(
        `Cannot delete job with ${applicationCount} applications. Please close the job instead.`
      );
    }

    await job.deleteOne();

    logger.info(`Job deleted: ${job.title}`);

    successResponse(res, null, "Job deleted successfully");
  }
);

/**
 * Bulk update job status
 */
export const bulkUpdateJobStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { jobIds, status }: BulkUpdateJobStatusInput = req.body;

    // Validate all IDs
    const validIds = jobIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== jobIds.length) {
      throw new CustomValidationError("Some job IDs are invalid");
    }

    // Update jobs
    const result = await Job.updateMany(
      { _id: { $in: validIds } },
      { status, updatedBy: req.user?._id }
    );

    logger.info(
      `Bulk updated ${result.modifiedCount} jobs to status: ${status}`
    );

    successResponse(
      res,
      {
        modifiedCount: result.modifiedCount,
        status,
      },
      `Successfully updated ${result.modifiedCount} jobs`
    );
  }
);

/**
 * Get job statistics
 */
export const getJobStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { clientId } = req.query;

    const filter: any = {};
    if (clientId) filter.clientId = clientId;

    const stats = await Job.aggregate([
      { $match: filter },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          byEmploymentType: [
            {
              $group: {
                _id: "$employmentType",
                count: { $sum: 1 },
              },
            },
          ],
          total: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);

    const result = {
      total: stats[0].total[0]?.count || 0,
      byStatus: stats[0].byStatus.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byEmploymentType: stats[0].byEmploymentType.reduce(
        (acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        },
        {}
      ),
    };

    successResponse(res, result, "Job statistics retrieved successfully");
  }
);
