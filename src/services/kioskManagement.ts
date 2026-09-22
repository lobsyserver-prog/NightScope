import { randomUUID } from 'node:crypto';

export type OwnerRegistrationStatus = 'pending' | 'active' | 'suspended';
export type KioskStatus = 'draft' | 'active' | 'suspended';

export interface KioskOwner {
  ownerId: string;
  propertyId: string;
  status: OwnerRegistrationStatus;
  registeredAt: string;
  activatedAt?: string;
}

export interface PropertyKiosk {
  id: string;
  ownerId: string;
  propertyId: string;
  name: string;
  status: KioskStatus;
  kioskUrl: string;
  createdAt: string;
  activatedAt?: string;
}

export interface KioskStaffAccess {
  id: string;
  kioskId: string;
  ownerId: string;
  staffId: string;
  staffEmail?: string;
  accessToken: string;
  status: 'active' | 'revoked';
  sharedAt: string;
  revokedAt?: string;
}

export class KioskManagementService {
  private readonly owners = new Map<string, KioskOwner>();
  private readonly kiosks = new Map<string, PropertyKiosk>();
  private readonly staffAccess = new Map<string, KioskStaffAccess>();

  registerOwner(ownerId: string, propertyId: string): KioskOwner {
    if (!ownerId.trim() || !propertyId.trim()) throw new Error('Owner and property are required');
    if (this.owners.has(ownerId)) throw new Error(`Owner ${ownerId} is already registered`);

    const owner: KioskOwner = { ownerId, propertyId, status: 'pending', registeredAt: new Date().toISOString() };
    this.owners.set(ownerId, owner);
    return owner;
  }

  activateOwner(ownerId: string): KioskOwner {
    const owner = this.requireOwner(ownerId);
    owner.status = 'active';
    owner.activatedAt = new Date().toISOString();
    return owner;
  }

  registerKiosk(ownerId: string, name = 'ScopeBridge Property Kiosk'): PropertyKiosk {
    const owner = this.requireActiveOwner(ownerId);
    if (!name.trim()) throw new Error('Kiosk name is required');

    const kioskId = `kiosk-${randomUUID().slice(0, 8)}`;
    const kiosk: PropertyKiosk = {
      id: kioskId,
      ownerId,
      propertyId: owner.propertyId,
      name,
      status: 'draft',
      kioskUrl: `/kiosk/${kioskId}`,
      createdAt: new Date().toISOString(),
    };
    this.kiosks.set(kiosk.id, kiosk);
    return kiosk;
  }

  activateKiosk(ownerId: string, kioskId: string): PropertyKiosk {
    const kiosk = this.requireOwnerKiosk(ownerId, kioskId);
    this.requireActiveOwner(ownerId);
    kiosk.status = 'active';
    kiosk.activatedAt = new Date().toISOString();
    return kiosk;
  }

  shareWithStaff(ownerId: string, kioskId: string, staffId: string, staffEmail?: string): KioskStaffAccess {
    const kiosk = this.requireOwnerKiosk(ownerId, kioskId);
    this.requireActiveOwner(ownerId);
    if (kiosk.status !== 'active') throw new Error('Kiosk must be active before it can be shared');
    if (!staffId.trim()) throw new Error('Staff ID is required');

    const existing = Array.from(this.staffAccess.values()).find((access) => access.kioskId === kioskId && access.staffId === staffId && access.status === 'active');
    if (existing) return { ...existing };

    const access: KioskStaffAccess = {
      id: `kiosk-access-${randomUUID().slice(0, 8)}`,
      kioskId,
      ownerId,
      staffId,
      staffEmail,
      accessToken: randomUUID(),
      status: 'active',
      sharedAt: new Date().toISOString(),
    };
    this.staffAccess.set(access.id, access);
    return access;
  }

  revokeStaffAccess(ownerId: string, accessId: string): KioskStaffAccess {
    const access = this.staffAccess.get(accessId);
    if (!access) throw new Error(`Kiosk access ${accessId} was not found`);
    if (access.ownerId !== ownerId) throw new Error('Only the kiosk owner can manage staff access');
    access.status = 'revoked';
    access.revokedAt = new Date().toISOString();
    return { ...access };
  }

  getKiosk(kioskId: string): PropertyKiosk | undefined {
    const kiosk = this.kiosks.get(kioskId);
    return kiosk ? { ...kiosk } : undefined;
  }

  getStaffAccess(kioskId: string): KioskStaffAccess[] {
    return Array.from(this.staffAccess.values())
      .filter((access) => access.kioskId === kioskId)
      .map((access) => ({ ...access }));
  }

  private requireOwner(ownerId: string): KioskOwner {
    const owner = this.owners.get(ownerId);
    if (!owner) throw new Error(`Owner ${ownerId} was not registered`);
    return owner;
  }

  private requireActiveOwner(ownerId: string): KioskOwner {
    const owner = this.requireOwner(ownerId);
    if (owner.status !== 'active') throw new Error('Owner must be active before using the kiosk');
    return owner;
  }

  private requireOwnerKiosk(ownerId: string, kioskId: string): PropertyKiosk {
    const kiosk = this.kiosks.get(kioskId);
    if (!kiosk) throw new Error(`Kiosk ${kioskId} was not found`);
    if (kiosk.ownerId !== ownerId) throw new Error('Only the kiosk owner can manage this kiosk');
    return kiosk;
  }
}

export default new KioskManagementService();
