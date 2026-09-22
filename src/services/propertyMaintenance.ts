export const BUILDSKILLS_PROVIDER = {
  id: 'builtskills',
  name: 'BuildSkills',
  url: 'https://builtskillsa.netlify.app',
  services: [
    'Building and construction',
    'Property maintenance',
    'Refurbishment',
    'Painting',
    'Repairs and renovations',
  ],
} as const;

export interface PropertyMaintenanceSelection {
  providerId: typeof BUILDSKILLS_PROVIDER.id;
  providerName: typeof BUILDSKILLS_PROVIDER.name;
  providerUrl: typeof BUILDSKILLS_PROVIDER.url;
  selectedAt: string;
}

export interface MaintainedProperty {
  propertyId: string;
  ownerId: string;
  maintenanceProvider?: PropertyMaintenanceSelection;
}

export class PropertyMaintenanceService {
  private readonly properties = new Map<string, MaintainedProperty>();

  registerProperty(propertyId: string, ownerId: string): MaintainedProperty {
    if (!propertyId.trim() || !ownerId.trim()) {
      throw new Error('Property and owner are required');
    }
    if (this.properties.has(propertyId)) {
      throw new Error(`Property ${propertyId} is already registered`);
    }

    const property = { propertyId, ownerId };
    this.properties.set(propertyId, property);
    return property;
  }

  selectBuildSkills(ownerId: string, propertyId: string): PropertyMaintenanceSelection {
    const property = this.requireOwner(propertyId, ownerId);
    const selection: PropertyMaintenanceSelection = {
      providerId: BUILDSKILLS_PROVIDER.id,
      providerName: BUILDSKILLS_PROVIDER.name,
      providerUrl: BUILDSKILLS_PROVIDER.url,
      selectedAt: new Date().toISOString(),
    };
    property.maintenanceProvider = selection;
    return selection;
  }

  clearProvider(ownerId: string, propertyId: string): void {
    const property = this.requireOwner(propertyId, ownerId);
    delete property.maintenanceProvider;
  }

  getProperty(propertyId: string): MaintainedProperty | undefined {
    return this.properties.get(propertyId);
  }

  private requireOwner(propertyId: string, ownerId: string): MaintainedProperty {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} was not found`);
    if (property.ownerId !== ownerId) throw new Error('Only the property owner can manage maintenance providers');
    return property;
  }
}

export default new PropertyMaintenanceService();
