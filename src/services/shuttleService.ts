export type ShuttleDriverStatus = 'pending' | 'approved' | 'suspended';
export type ShuttleVehicleStatus = 'pending' | 'approved' | 'rejected';

export interface ShuttleDriver {
  id: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  status: ShuttleDriverStatus;
  vehicleIds: string[];
  createdAt: string;
}

export interface ShuttleVehicle {
  id: string;
  driverId: string;
  registrationNumber: string;
  makeModel: string;
  color: string;
  seats: number;
  wheelchairAccessible: boolean;
  status: ShuttleVehicleStatus;
  createdAt: string;
}

export interface ShuttleRequest {
  id: string;
  guestId: string;
  pickup: string;
  dropoff: string;
  pickupAt: string;
  passengerCount: number;
  wheelchairRequired: boolean;
  status: 'pending' | 'assigned' | 'cancelled';
  driverId?: string;
  vehicleId?: string;
  createdAt: string;
}

export class ShuttleService {
  private readonly drivers = new Map<string, ShuttleDriver>();
  private readonly vehicles = new Map<string, ShuttleVehicle>();
  private readonly requests = new Map<string, ShuttleRequest>();
  private driverSequence = 0;
  private vehicleSequence = 0;
  private requestSequence = 0;

  registerDriver(input: Omit<ShuttleDriver, 'id' | 'status' | 'vehicleIds' | 'createdAt'>): ShuttleDriver {
    if (!input.fullName.trim() || !input.phone.trim() || !input.licenseNumber.trim()) {
      throw new Error('Driver name, phone, and license number are required');
    }
    if (Array.from(this.drivers.values()).some((driver) => driver.licenseNumber === input.licenseNumber)) {
      throw new Error(`Driver license ${input.licenseNumber} is already registered`);
    }

    const driver: ShuttleDriver = {
      ...input,
      id: `shuttle-driver-${++this.driverSequence}`,
      status: 'pending',
      vehicleIds: [],
      createdAt: new Date().toISOString(),
    };
    this.drivers.set(driver.id, driver);
    return driver;
  }

  registerVehicle(input: Omit<ShuttleVehicle, 'id' | 'status' | 'createdAt'>): ShuttleVehicle {
    const driver = this.requireDriver(input.driverId);
    if (!input.registrationNumber.trim() || !input.makeModel.trim() || input.seats < 1) {
      throw new Error('Vehicle registration, make/model, and a positive seat count are required');
    }
    if (Array.from(this.vehicles.values()).some((vehicle) => vehicle.registrationNumber === input.registrationNumber)) {
      throw new Error(`Vehicle ${input.registrationNumber} is already registered`);
    }

    const vehicle: ShuttleVehicle = {
      ...input,
      id: `shuttle-vehicle-${++this.vehicleSequence}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.vehicles.set(vehicle.id, vehicle);
    driver.vehicleIds.push(vehicle.id);
    return vehicle;
  }

  approveDriver(driverId: string): ShuttleDriver {
    const driver = this.requireDriver(driverId);
    driver.status = 'approved';
    return driver;
  }

  approveVehicle(vehicleId: string): ShuttleVehicle {
    const vehicle = this.requireVehicle(vehicleId);
    vehicle.status = 'approved';
    return vehicle;
  }

  createRequest(input: Omit<ShuttleRequest, 'id' | 'status' | 'createdAt' | 'driverId' | 'vehicleId'>): ShuttleRequest {
    if (!input.guestId.trim() || !input.pickup.trim() || !input.dropoff.trim()) {
      throw new Error('Guest, pickup, and dropoff are required');
    }
    if (input.passengerCount < 1 || !Number.isInteger(input.passengerCount)) {
      throw new Error('passengerCount must be a positive integer');
    }
    if (Number.isNaN(Date.parse(input.pickupAt))) {
      throw new Error('pickupAt must be a valid date');
    }

    const request: ShuttleRequest = {
      ...input,
      id: `shuttle-request-${++this.requestSequence}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.requests.set(request.id, request);
    return request;
  }

  findAvailableDrivers(request: ShuttleRequest): Array<{ driver: ShuttleDriver; vehicle: ShuttleVehicle }> {
    return Array.from(this.drivers.values()).flatMap((driver) => {
      if (driver.status !== 'approved') return [];

      const vehicle = driver.vehicleIds
        .map((vehicleId) => this.vehicles.get(vehicleId))
        .find((candidate) => candidate?.status === 'approved'
          && candidate.seats >= request.passengerCount
          && (!request.wheelchairRequired || candidate.wheelchairAccessible));

      return vehicle ? [{ driver, vehicle }] : [];
    });
  }

  assignDriver(requestId: string, driverId: string, vehicleId?: string): ShuttleRequest {
    const request = this.requireRequest(requestId);
    const match = this.findAvailableDrivers(request).find(({ driver, vehicle }) => (
      driver.id === driverId && (!vehicleId || vehicle.id === vehicleId)
    ));

    if (!match) {
      throw new Error(`Driver ${driverId} is not available for this shuttle request`);
    }

    request.status = 'assigned';
    request.driverId = match.driver.id;
    request.vehicleId = match.vehicle.id;
    return request;
  }

  cancelRequest(requestId: string): ShuttleRequest {
    const request = this.requireRequest(requestId);
    request.status = 'cancelled';
    delete request.driverId;
    delete request.vehicleId;
    return request;
  }

  getDriver(driverId: string): ShuttleDriver | undefined {
    return this.drivers.get(driverId);
  }

  getVehicle(vehicleId: string): ShuttleVehicle | undefined {
    return this.vehicles.get(vehicleId);
  }

  getRequest(requestId: string): ShuttleRequest | undefined {
    return this.requests.get(requestId);
  }

  getPublicProfiles(): Array<{ driver: ShuttleDriver; vehicles: ShuttleVehicle[] }> {
    return Array.from(this.drivers.values())
      .filter((driver) => driver.status === 'approved')
      .map((driver) => ({
        driver: { ...driver, vehicleIds: [...driver.vehicleIds] },
        vehicles: driver.vehicleIds
          .map((vehicleId) => this.vehicles.get(vehicleId))
          .filter((vehicle): vehicle is ShuttleVehicle => vehicle?.status === 'approved')
          .map((vehicle) => ({ ...vehicle })),
      }))
      .filter((profile) => profile.vehicles.length > 0);
  }

  private requireDriver(driverId: string): ShuttleDriver {
    const driver = this.drivers.get(driverId);
    if (!driver) throw new Error(`Driver ${driverId} was not found`);
    return driver;
  }

  private requireVehicle(vehicleId: string): ShuttleVehicle {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} was not found`);
    return vehicle;
  }

  private requireRequest(requestId: string): ShuttleRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Shuttle request ${requestId} was not found`);
    return request;
  }
}

export default new ShuttleService();
