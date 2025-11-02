import { Request, Response } from "express";
import {
  candidateService,
  clientService,
  jobService,
} from "../services/firestore";
import {
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from "../types/client.types";
import {
  BadRequestError,
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
 * Calculate statistics for a client
 */
async function calculateClientStatistics(clientId: string) {
  // Get all jobs for this client
  const jobs = await jobService.findByClient(clientId);

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.status === "open").length;
  const closedJobs = jobs.filter((j) => j.status === "closed").length;
  const draftJobs = jobs.filter((j) => j.status === "draft").length;

  // Get all candidates for this client's jobs
  const jobIds = jobs.map((j) => j.id!);
  const allCandidates = await Promise.all(
    jobIds.map((jobId) => candidateService.findByJobId(jobId))
  );
  const candidates = allCandidates.flat();

  const totalCandidates = candidates.length;
  const activeCandidates = candidates.filter((c) =>
    ["active", "interviewing", "offered"].includes(c.status || "")
  ).length;
  const hiredCandidates = candidates.filter((c) => c.status === "hired").length;
  const rejectedCandidates = candidates.filter((c) =>
    ["rejected", "withdrawn"].includes(c.status || "")
  ).length;

  // Calculate success rate
  const successRate =
    totalCandidates > 0
      ? Math.round((hiredCandidates / totalCandidates) * 100)
      : 0;

  // Calculate average time to hire (simplified - days from candidate creation to hired)
  const hiredCandidates_list = candidates.filter((c) => c.status === "hired");
  let averageTimeToHire = 0;
  if (hiredCandidates_list.length > 0) {
    const totalDays = hiredCandidates_list.reduce(
      (sum: number, candidate: any) => {
        const days = Math.floor(
          (Date.now() - new Date(candidate.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return sum + days;
      },
      0
    );
    averageTimeToHire = Math.round(totalDays / hiredCandidates_list.length);
  }

  return {
    totalJobs,
    activeJobs,
    closedJobs,
    draftJobs,
    totalCandidates,
    activeCandidates,
    hiredCandidates,
    rejectedCandidates,
    successRate,
    averageTimeToHire,
  };
}

/**
 * Create new client
 */
export const createClient = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data: CreateClientInput = req.body;

    console.log("=== BACKEND CREATE CLIENT ===");
    console.log("Received data:", data);
    console.log("Contacts in request:", data.contacts);
    console.log("============================");

    // Check for duplicate client by companyName
    const existingClients = await clientService.find([
      { field: "companyName", operator: "==", value: data.companyName },
    ]);

    if (existingClients.length > 0) {
      throw new CustomValidationError(
        `Client already exists with name: ${data.companyName}`
      );
    }

    // Add IDs to contacts if they don't have them
    const contacts =
      data.contacts?.map((contact: any, index) => ({
        ...contact,
        id: contact.id || `contact_${Date.now()}_${index}`,
      })) || [];

    console.log("=== CONTACTS WITH IDS ===");
    console.log("Processed contacts:", contacts);
    console.log("========================");

    // Create client
    const clientId = await clientService.create({
      ...data,
      contacts,
      createdBy: req.user?.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const client = await clientService.findById(clientId);
    if (!client) {
      throw new Error("Failed to create client");
    }

    console.log("=== CREATED CLIENT ===");
    console.log("Client ID:", clientId);
    console.log("Client contacts:", client.contacts);
    console.log("=====================");

    logger.info(
      `Client created: ${client.companyName} by user ${req.user?.id}`
    );

    successResponse(res, client, "Client created successfully", 201);
  }
);

/**
 * Get all clients with filters and pagination
 */
export const getClients = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      isActive,
      industry,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as any as ListClientsQuery;

    // Build filters
    const filters: any[] = [];
    if (isActive !== undefined) {
      filters.push({ field: "isActive", operator: "==", value: isActive });
    }
    if (industry) {
      filters.push({ field: "industry", operator: "==", value: industry });
    }

    // Get all clients (Firestore doesn't support complex OR queries easily, so filter in memory)
    let clients = await clientService.find(filters);

    // Apply search filter in memory
    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(
        (c) =>
          c.companyName?.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          c.contacts?.some(
            (contact) =>
              contact.name?.toLowerCase().includes(searchLower) ||
              contact.email?.toLowerCase().includes(searchLower)
          )
      );
    }

    // Sort clients
    clients.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    const totalCount = clients.length;

    // Calculate pagination
    const pagination = paginateResults(totalCount, {
      page,
      limit,
      sort: sortBy,
      order: sortOrder,
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedClients = clients.slice(skip, skip + limit);

    // Calculate statistics for each client
    const clientsWithStats = await Promise.all(
      paginatedClients.map(async (client) => {
        const stats = await calculateClientStatistics(client.id!);
        return {
          ...client,
          statistics: stats,
        };
      })
    );

    successResponse(
      res,
      {
        clients: clientsWithStats,
        pagination,
      },
      "Clients retrieved successfully"
    );
  }
);

/**
 * Get single client by ID
 */
export const getClientById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Validate ID
    if (!id || id === "undefined") {
      throw new BadRequestError("Invalid client ID");
    }

    const client = await clientService.findById(id);

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    // Calculate real-time statistics
    const statistics = await calculateClientStatistics(id);

    // Response with client and statistics
    successResponse(
      res,
      {
        ...client,
        statistics,
      },
      "Client retrieved successfully"
    );
  }
);

/**
 * Update client
 */
export const updateClient = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates: UpdateClientInput = req.body;

    console.log("=== UPDATE CLIENT ===");
    console.log("Client ID:", id);
    console.log("Updates received:", JSON.stringify(updates, null, 2));
    console.log("Contacts in updates:", (updates as any).contacts);
    console.log(
      "ActivityHistory in updates:",
      (updates as any).activityHistory
    );
    console.log("====================");

    const client = await clientService.findById(id);

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    // Check if companyName is being changed and if it creates a duplicate
    if (updates.companyName && updates.companyName !== client.companyName) {
      const existingClients = await clientService.find([
        { field: "companyName", operator: "==", value: updates.companyName },
      ]);
      const existingClient = existingClients.find((c) => c.id !== id);

      if (existingClient) {
        throw new CustomValidationError(
          `Client already exists with name: ${updates.companyName}`
        );
      }
    }

    // Update client
    await clientService.update(id, {
      ...updates,
      updatedBy: req.user?.id,
      updatedAt: new Date(),
    } as any);

    const updatedClient = await clientService.findById(id);

    console.log("=== UPDATED CLIENT ===");
    console.log("Updated client contacts:", updatedClient?.contacts);
    console.log(
      "Updated client activityHistory:",
      updatedClient?.activityHistory?.length
    );
    console.log("======================");

    logger.info(`Client updated: ${updatedClient?.companyName}`);

    successResponse(res, updatedClient, "Client updated successfully");
  }
);

/**
 * Delete client
 */
export const deleteClient = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const client = await clientService.findById(id);

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    // Check if there are associated jobs
    const jobs = await jobService.findByClient(id);

    if (jobs.length > 0) {
      throw new CustomValidationError(
        `Cannot delete client with ${jobs.length} active jobs. Please remove or reassign the jobs first.`
      );
    }

    await clientService.delete(id);

    logger.info(`Client deleted: ${client.companyName}`);

    successResponse(res, null, "Client deleted successfully");
  }
);

/**
 * Get client statistics
 */
export const getClientStats = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    // Get all clients
    const allClients = await clientService.find([]);

    const stats = {
      byStatus: [
        {
          _id: "active",
          count: allClients.filter((c) => c.status === "active").length,
        },
        {
          _id: "inactive",
          count: allClients.filter((c) => c.status === "inactive").length,
        },
        {
          _id: "pending",
          count: allClients.filter((c) => c.status === "pending").length,
        },
        {
          _id: "on_hold",
          count: allClients.filter((c) => c.status === "on_hold").length,
        },
      ],
      byIndustry: Array.from(
        allClients.reduce((map, client) => {
          const industry = client.industry || "Unknown";
          map.set(industry, (map.get(industry) || 0) + 1);
          return map;
        }, new Map<string, number>())
      ).map(([_id, count]) => ({ _id, count })),
      total: allClients.length,
    };

    const result = {
      total: stats.total,
      byStatus: stats.byStatus.reduce((acc: any, item: any) => {
        acc[item._id ? "active" : "inactive"] = item.count;
        return acc;
      }, {}),
      topIndustries: stats.byIndustry.slice(0, 10), // Top 10 industries
    };

    successResponse(res, result, "Client statistics retrieved successfully");
  }
);

/**
 * Add communication note to client
 */
export const addCommunicationNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { type, subject, content } = req.body;

    const client = await clientService.findById(id);

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    // Create note with user info
    const note = {
      clientId: id,
      type,
      subject,
      content,
      createdBy: req.user?.id || "system",
      createdByName: req.user
        ? `${req.user.firstName} ${req.user.lastName}`
        : "System",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add note using the service method
    await clientService.addCommunicationNote(id, note);

    // Add activity for the communication note
    await clientService.addActivity(id, {
      action: "communication_logged",
      description: `Communication logged: ${type.replace(/_/g, " ")} - "${subject}"`,
      performedBy: req.user?.id || "system",
      performedByName: req.user
        ? `${req.user.firstName} ${req.user.lastName}`
        : "System",
      timestamp: new Date(),
    });

    // Get updated client
    const updatedClient = await clientService.findById(id);

    logger.info(`Communication note added to client: ${client.companyName}`);

    successResponse(
      res,
      updatedClient,
      "Communication note added successfully"
    );
  }
);
