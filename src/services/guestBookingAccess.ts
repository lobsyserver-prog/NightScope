import nannyOnCallService, { NannyOnCallService, NannyProfile } from './nannyOnCall';
import shuttleServiceSingleton, { ShuttleDriver, ShuttleService, ShuttleVehicle } from './shuttleService';

export interface GuestBookingLink {
  id: 'nanny' | 'shuttle';
  label: string;
  href: string;
  actionLabel: string;
}

export interface PublicShuttleProfile {
  driver: ShuttleDriver;
  vehicles: ShuttleVehicle[];
}

export class GuestBookingAccessService {
  constructor(
    private readonly nannyService: NannyOnCallService = nannyOnCallService,
    private readonly shuttleService: ShuttleService = shuttleServiceSingleton
  ) {}

  getBookingLinks(): GuestBookingLink[] {
    return [
      { id: 'nanny', label: 'Book a Nanny', href: '/guest/nanny/book', actionLabel: 'Book below' },
      { id: 'shuttle', label: 'Book a Shuttle', href: '/guest/shuttle/book', actionLabel: 'Book below' },
    ];
  }

  getNannyProfiles(): NannyProfile[] {
    return this.nannyService.getPublicProfiles();
  }

  getShuttleProfiles(): PublicShuttleProfile[] {
    return this.shuttleService.getPublicProfiles();
  }
}

export default new GuestBookingAccessService();
