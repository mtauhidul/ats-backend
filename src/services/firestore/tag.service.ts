import { FirestoreBaseService } from "./base.service";

export interface ITag {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  type: "job" | "candidate" | "skill" | "general";
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class TagService extends FirestoreBaseService<ITag> {
  constructor() {
    super("tags");
  }

  async findByName(name: string): Promise<ITag | null> {
    const tags = await this.find([
      { field: "name", operator: "==", value: name },
    ]);
    return tags.length > 0 ? tags[0] : null;
  }

  async findByType(type: ITag["type"]): Promise<ITag[]> {
    return this.find([{ field: "type", operator: "==", value: type }]);
  }

  async findActive(): Promise<ITag[]> {
    return this.find([{ field: "isActive", operator: "==", value: true }]);
  }

  async findActiveByType(type: ITag["type"]): Promise<ITag[]> {
    return this.find([
      { field: "type", operator: "==", value: type },
      { field: "isActive", operator: "==", value: true },
    ]);
  }

  async activate(id: string, updatedBy?: string): Promise<void> {
    await this.update(id, {
      isActive: true,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  async deactivate(id: string, updatedBy?: string): Promise<void> {
    await this.update(id, {
      isActive: false,
      updatedAt: new Date(),
      updatedBy,
    });
  }
}

export const tagService = new TagService();
