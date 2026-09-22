export type FleetVehicleStatus = 'pending' | 'approved' | 'suspended';
export type FleetFineStatus = 'unpaid' | 'paid' | 'waived';

export interface FleetVehicle {
  id: string;
  ownerId: string;
  registrationNumber: string;
  makeModel: string;
  vin: string;
  seats: number;
  licenseDiskExpiresAt: string;
  status: FleetVehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FleetFine {
  id: string;
  vehicleId: string;
  amountMinor: number;
  currency: string;
  reason: string;
  issuedAt: string;
  dueAt: string;
  status: FleetFineStatus;
  paidAt?: string;
  paymentReference?: string;
}

export interface FleetComplianceSummary {
  vehicleId: string;
  licenseDiskExpired: boolean;
  unpaidFinesMinor: number;
  unpaidFines: number;
  status: FleetVehicleStatus;
}

export class FleetManagementService {
  private readonly vehicles = new Map<string, FleetVehicle>();
  private readonly fines = new Map<string, FleetFine>();
  private vehicleSequence = 0;
  private fineSequence = 0;

  registerVehicle(input: Omit<FleetVehicle, 'id' | 'status' | 'createdAt' | 'updatedAt'>): FleetVehicle {
    if (!input.ownerId.trim() || !input.registrationNumber.trim() || !input.makeModel.trim() || !input.vin.trim()) {
      throw new Error('Owner, registration number, make/model, and VIN are required');
    }
    if (input.seats < 1 || !Number.isInteger(input.seats)) {
      throw new Error('Vehicle seats must be a positive integer');
    }
    this.validateDate(input.licenseDiskExpiresAt, 'licenseDiskExpiresAt');
    if (Array.from(this.vehicles.values()).some((vehicle) => vehicle.registrationNumber === input.registrationNumber)) {
      throw new Error(`Vehicle ${input.registrationNumber} is already registered`);
    }

    const now = new Date().toISOString();
    const vehicle: FleetVehicle = {
      ...input,
      id: `fleet-vehicle-${++this.vehicleSequence}`,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  getVehicle(vehicleId: string): FleetVehicle | undefined {
    return this.vehicles.get(vehicleId);
  }

  getOwnerVehicles(ownerId: string): FleetVehicle[] {
    return Array.from(this.vehicles.values()).filter((vehicle) => vehicle.ownerId === ownerId);
  }

  approveVehicle(role: 'owner' | 'admin', vehicleId: string): FleetVehicle {
    this.requireAdmin(role);
    const vehicle = this.requireVehicle(vehicleId);
    vehicle.status = 'approved';
    vehicle.updatedAt = new Date().toISOString();
    return vehicle;
  }

  suspendVehicle(role: 'owner' | 'admin', vehicleId: string): FleetVehicle {
    this.requireAdmin(role);
    const vehicle = this.requireVehicle(vehicleId);
    vehicle.status = 'suspended';
    vehicle.updatedAt = new Date().toISOString();
    return vehicle;
  }

  renewLicenseDisk(
    role: 'owner' | 'admin',
    vehicleId: string,
    expiresAt: string,
    renewalFeeMinor: number,
    paymentReference?: string
  ): FleetVehicle {
    this.requireAdmin(role);
    if (renewalFeeMinor < 0 || !Number.isSafeInteger(renewalFeeMinor)) {
      throw new Error('Renewal fee must be a valid non-negative amount');
    }
    this.validateDate(expiresAt, 'expiresAt');
    const vehicle = this.requireVehicle(vehicleId);
    vehicle.licenseDiskExpiresAt = expiresAt;
    vehicle.updatedAt = new Date().toISOString();
    return vehicle;
  }

  issueFine(
    role: 'owner' | 'admin',
    vehicleId: string,
    amountMinor: number,
    reason: string,
    dueAt: string,
    currency = 'ZAR'
  ): FleetFine {
    this.requireAdmin(role);
    if (amountMinor <= 0 || !Number.isSafeInteger(amountMinor) || !reason.trim()) {
      throw new Error('Fine requires a positive amount and reason');
    }
    this.validateDate(dueAt, 'dueAt');
    this.requireVehicle(vehicleId);

    const fine: FleetFine = {
      id: `fleet-fine-${++this.fineSequence}`,
      vehicleId,
      amountMinor,
      currency: currency.toUpperCase(),
      reason,
      issuedAt: new Date().toISOString(),
      dueAt,
      status: 'unpaid',
    };
    this.fines.set(fine.id, fine);
    return fine;
  }

  payFine(role: 'owner' | 'admin', fineId: string, paymentReference: string): FleetFine {
    this.requireAdmin(role);
    const fine = this.fines.get(fineId);
    if (!fine) throw new Error(`Fine ${fineId} was not found`);
    if (!paymentReference.trim()) throw new Error('Payment reference is required');
    if (fine.status !== 'unpaid') throw new Error('Fine is no longer unpaid');

    fine.status = 'paid';
    fine.paidAt = new Date().toISOString();
    fine.paymentReference = paymentReference;
    return fine;
  }

  waiveFine(role: 'owner' | 'admin', fineId: string): FleetFine {
    this.requireAdmin(role);
    const fine = this.fines.get(fineId);
    if (!fine) throw new Error(`Fine ${fineId} was not found`);
    fine.status = 'waived';
    return fine;
  }

  getVehicleFines(vehicleId: string): FleetFine[] {
    this.requireVehicle(vehicleId);
    return Array.from(this.fines.values()).filter((fine) => fine.vehicleId === vehicleId);
  }

  getComplianceSummary(vehicleId: string, now = new Date()): FleetComplianceSummary {
    const vehicle = this.requireVehicle(vehicleId);
    const vehicleFines = this.getVehicleFines(vehicleId);
    return {
      vehicleId,
      licenseDiskExpired: Date.parse(vehicle.licenseDiskExpiresAt) < now.getTime(),
      unpaidFinesMinor: vehicleFines.filter((fine) => fine.status === 'unpaid').reduce((total, fine) => total + fine.amountMinor, 0),
      unpaidFines: vehicleFines.filter((fine) => fine.status === 'unpaid').length,
      status: vehicle.status,
    };
  }

  private requireVehicle(vehicleId: string): FleetVehicle {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} was not found`);
    return vehicle;
  }

  private requireAdmin(role: 'owner' | 'admin'): void {
    if (role !== 'admin') throw new Error('Only admins can manage fleet compliance');
  }

  private validateDate(value: string, fieldName: string): void {
    if (Number.isNaN(Date.parse(value))) throw new Error(`${fieldName} must be a valid date`);
  }
}

export default new FleetManagementService();
