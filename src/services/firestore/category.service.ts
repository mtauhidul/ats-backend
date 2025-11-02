import { FirestoreBaseService } from "./base.service";

export interface ICategory {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  type: "job" | "candidate" | "general";
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

class CategoryService extends FirestoreBaseService<ICategory> {
  constructor() {
    super("categories");
  }

  async findByName(name: string): Promise<ICategory | null> {
    const categories = await this.find([
      { field: "name", operator: "==", value: name },
    ]);
    return categories.length > 0 ? categories[0] : null;
  }

  async findByType(type: ICategory["type"]): Promise<ICategory[]> {
    return this.find([{ field: "type", operator: "==", value: type }]);
  }

  async findActive(): Promise<ICategory[]> {
    return this.find([{ field: "isActive", operator: "==", value: true }]);
  }

  async findActiveByType(type: ICategory["type"]): Promise<ICategory[]> {
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

export const categoryService = new CategoryService();
