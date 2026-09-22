export interface CarHireVehicle {
  id: string;
  providerName: string;
  makeModel: string;
  registrationNumber: string;
  seats: number;
  dailyRateMinor: number;
  currency: string;
  status: 'available' | 'unavailable';
}

export interface CarHireBooking {
  id: string;
  vehicleId: string;
  guestId: string;
  pickupAt: string;
  returnAt: string;
  totalPriceMinor: number;
  currency: string;
  status: 'confirmed' | 'cancelled';
}

export class CarHireService {
  private readonly vehicles = new Map<string, CarHireVehicle>();
  private readonly bookings = new Map<string, CarHireBooking>();
  private vehicleSequence = 0;
  private bookingSequence = 0;

  registerVehicle(input: Omit<CarHireVehicle, 'id' | 'status'>): CarHireVehicle {
    if (!input.providerName.trim() || !input.makeModel.trim() || input.seats < 1 || input.dailyRateMinor <= 0) {
      throw new Error('Provider, vehicle, seats, and a positive daily rate are required');
    }

    const vehicle: CarHireVehicle = {
      ...input,
      id: `car-${++this.vehicleSequence}`,
      status: 'available',
      currency: input.currency.toUpperCase(),
    };
    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  searchAvailable(pickupAt: string, returnAt: string, minimumSeats = 1): CarHireVehicle[] {
    this.validateRange(pickupAt, returnAt);
    return Array.from(this.vehicles.values()).filter((vehicle) => (
      vehicle.status === 'available'
      && vehicle.seats >= minimumSeats
      && !Array.from(this.bookings.values()).some((booking) => (
        booking.vehicleId === vehicle.id
        && booking.status === 'confirmed'
        && this.overlaps(pickupAt, returnAt, booking.pickupAt, booking.returnAt)
      ))
    ));
  }

  bookVehicle(vehicleId: string, guestId: string, pickupAt: string, returnAt: string): CarHireBooking {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) throw new Error(`Car ${vehicleId} was not found`);
    if (!guestId.trim()) throw new Error('guestId is required');
    const days = this.daysBetween(pickupAt, returnAt);
    if (!this.searchAvailable(pickupAt, returnAt).some((candidate) => candidate.id === vehicleId)) {
      throw new Error(`Car ${vehicleId} is not available for these dates`);
    }

    const booking: CarHireBooking = {
      id: `car-booking-${++this.bookingSequence}`,
      vehicleId,
      guestId,
      pickupAt,
      returnAt,
      totalPriceMinor: days * vehicle.dailyRateMinor,
      currency: vehicle.currency,
      status: 'confirmed',
    };
    this.bookings.set(booking.id, booking);
    return booking;
  }

  private daysBetween(start: string, end: string): number {
    return Math.ceil((Date.parse(end) - Date.parse(start)) / 86_400_000);
  }

  private overlaps(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string): boolean {
    return Date.parse(firstStart) < Date.parse(secondEnd) && Date.parse(secondStart) < Date.parse(firstEnd);
  }

  private validateRange(start: string, end: string): void {
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
      throw new Error('pickupAt and returnAt must be valid dates with returnAt after pickupAt');
    }
  }
}

export default new CarHireService();
