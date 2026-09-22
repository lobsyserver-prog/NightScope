import { describe, expect, it } from 'vitest';
import { BUILDSKILLS_PROVIDER, PropertyMaintenanceService } from '../services/propertyMaintenance';

describe('PropertyMaintenanceService', () => {
  it('lets the owner select BuildSkills for property work', () => {
    const service = new PropertyMaintenanceService();
    service.registerProperty('property-1', 'owner-1');

    const selection = service.selectBuildSkills('owner-1', 'property-1');

    expect(selection).toMatchObject({
      providerId: 'builtskills',
      providerName: 'BuildSkills',
      providerUrl: 'https://builtskillsa.netlify.app',
    });
    expect(BUILDSKILLS_PROVIDER.services).toContain('Refurbishment');
    expect(BUILDSKILLS_PROVIDER.services).toContain('Painting');
  });

  it('prevents another user from changing the owner selection', () => {
    const service = new PropertyMaintenanceService();
    service.registerProperty('property-1', 'owner-1');

    expect(() => service.selectBuildSkills('other-owner', 'property-1')).toThrow('Only the property owner');
  });
});
