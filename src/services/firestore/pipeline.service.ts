import { FirestoreBaseService } from "./base.service";

export interface IPipelineStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  color?: string;
  isActive: boolean;
}

export interface IPipeline {
  id?: string;
  name: string;
  description?: string;
  type: "candidate" | "interview" | "custom";
  stages: IPipelineStage[];
  jobId?: string; // Reference to the job this pipeline belongs to
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class PipelineService extends FirestoreBaseService<IPipeline> {
  constructor() {
    super("pipelines");
  }

  /**
   * Override create to ensure all stages have unique IDs
   */
  async create(data: Partial<IPipeline>): Promise<string> {
    // Ensure all stages have unique IDs
    if (data.stages && Array.isArray(data.stages)) {
      data.stages = data.stages.map((stage, index) => ({
        ...stage,
        id: stage.id || `stage_${Date.now()}_${index}`,
      }));
    }
    
    return super.create(data as Omit<IPipeline, "id">);
  }

  /**
   * Override update to ensure any new stages have unique IDs
   */
  async update(id: string, data: Partial<IPipeline>): Promise<void> {
    // Ensure all stages have unique IDs
    if (data.stages && Array.isArray(data.stages)) {
      data.stages = data.stages.map((stage, index) => ({
        ...stage,
        id: stage.id || `stage_${Date.now()}_${index}`,
      }));
    }
    
    return super.update(id, data);
  }

  /**
   * Find pipeline by jobId
   */
  async findByJobId(jobId: string): Promise<IPipeline | null> {
    const pipelines = await this.find([
      { field: "jobId", operator: "==", value: jobId },
    ]);
    return pipelines.length > 0 ? pipelines[0] : null;
  }

  /**
   * Find pipeline by name
   */
  async findByName(name: string): Promise<IPipeline | null> {
    const pipelines = await this.find([
      { field: "name", operator: "==", value: name },
    ]);
    return pipelines.length > 0 ? pipelines[0] : null;
  }

  /**
   * Find pipelines by type
   */
  async findByType(type: IPipeline["type"]): Promise<IPipeline[]> {
    return this.find([{ field: "type", operator: "==", value: type }]);
  }

  /**
   * Find active pipelines
   */
  async findActive(): Promise<IPipeline[]> {
    return this.find([{ field: "isActive", operator: "==", value: true }]);
  }

  /**
   * Find active pipelines by type
   */
  async findActiveByType(type: IPipeline["type"]): Promise<IPipeline[]> {
    return this.find([
      { field: "type", operator: "==", value: type },
      { field: "isActive", operator: "==", value: true },
    ]);
  }

  /**
   * Find default pipeline by type
   */
  async findDefaultByType(type: IPipeline["type"]): Promise<IPipeline | null> {
    const pipelines = await this.find([
      { field: "type", operator: "==", value: type },
      { field: "isDefault", operator: "==", value: true },
    ]);
    return pipelines.length > 0 ? pipelines[0] : null;
  }

  /**
   * Set pipeline as default (ensures only one default per type)
   */
  async setAsDefault(id: string, type: IPipeline["type"]): Promise<void> {
    // First, unset any existing default for this type
    const existingDefaults = await this.find([
      { field: "type", operator: "==", value: type },
      { field: "isDefault", operator: "==", value: true },
    ]);

    // Use batch update to ensure atomicity
    const updates: Promise<void>[] = [];

    // Unset existing defaults
    for (const pipeline of existingDefaults) {
      if (pipeline.id && pipeline.id !== id) {
        updates.push(
          this.update(pipeline.id, {
            isDefault: false,
            updatedAt: new Date(),
          })
        );
      }
    }

    // Set new default
    updates.push(
      this.update(id, {
        isDefault: true,
        updatedAt: new Date(),
      })
    );

    await Promise.all(updates);
  }

  /**
   * Add stage to pipeline
   */
  async addStage(
    id: string,
    stage: Omit<IPipelineStage, "id">
  ): Promise<void> {
    const pipeline = await this.findById(id);
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const stages = pipeline.stages || [];
    const newStage: IPipelineStage = {
      ...stage,
      id: `stage_${Date.now()}`,
    };

    stages.push(newStage);

    await this.update(id, {
      stages,
      updatedAt: new Date(),
    });
  }

  /**
   * Update stage in pipeline
   */
  async updateStage(
    id: string,
    stageId: string,
    updates: Partial<Omit<IPipelineStage, "id">>
  ): Promise<void> {
    const pipeline = await this.findById(id);
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const stages = pipeline.stages.map((stage) =>
      stage.id === stageId ? { ...stage, ...updates } : stage
    );

    await this.update(id, {
      stages,
      updatedAt: new Date(),
    });
  }

  /**
   * Remove stage from pipeline
   */
  async removeStage(id: string, stageId: string): Promise<void> {
    const pipeline = await this.findById(id);
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const stages = pipeline.stages.filter((stage) => stage.id !== stageId);

    await this.update(id, {
      stages,
      updatedAt: new Date(),
    });
  }

  /**
   * Reorder stages in pipeline
   */
  async reorderStages(
    id: string,
    stageOrders: Array<{ id: string; order: number }>
  ): Promise<void> {
    const pipeline = await this.findById(id);
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const orderMap = new Map(stageOrders.map((s) => [s.id, s.order]));

    const stages = pipeline.stages.map((stage) => ({
      ...stage,
      order: orderMap.get(stage.id) ?? stage.order,
    }));

    // Sort by order
    stages.sort((a, b) => a.order - b.order);

    await this.update(id, {
      stages,
      updatedAt: new Date(),
    });
  }

  /**
   * Get stage by ID from pipeline
   */
  async getStage(
    pipelineId: string,
    stageId: string
  ): Promise<IPipelineStage | null> {
    const pipeline = await this.findById(pipelineId);
    if (!pipeline) {
      return null;
    }

    const stage = pipeline.stages.find((s) => s.id === stageId);
    return stage || null;
  }

  /**
   * Activate pipeline
   */
  async activate(id: string, updatedBy?: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Deactivate pipeline
   */
  async deactivate(id: string, updatedBy?: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Clone pipeline with new name
   */
  async clone(
    id: string,
    newName: string,
    createdBy: string
  ): Promise<string> {
    const originalPipeline = await this.findById(id);
    if (!originalPipeline) {
      throw new Error("Pipeline not found");
    }

    // Create new stages with new IDs
    const clonedStages: IPipelineStage[] = originalPipeline.stages.map(
      (stage) => ({
        ...stage,
        id: `stage_${Date.now()}_${Math.random()}`,
      })
    );

    const clonedPipeline: Omit<IPipeline, "id"> = {
      name: newName,
      description: originalPipeline.description,
      type: originalPipeline.type,
      stages: clonedStages,
      isDefault: false, // Cloned pipelines are never default
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.create(clonedPipeline);
  }

  /**
   * Subscribe to active pipelines
   */
  subscribeToActivePipelines(
    callback: (pipelines: IPipeline[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "isActive", operator: "==", value: true }],
      callback,
      options
    );
  }

  /**
   * Subscribe to pipelines by type
   */
  subscribeToPipelinesByType(
    type: IPipeline["type"],
    callback: (pipelines: IPipeline[]) => void,
    options?: { limit?: number }
  ): () => void {
    return this.subscribeToCollection(
      [{ field: "type", operator: "==", value: type }],
      callback,
      options
    );
  }
}

export const pipelineService = new PipelineService();
