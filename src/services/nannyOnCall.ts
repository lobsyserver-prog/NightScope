export interface NannyAvailability {
  startAt: string;
  endAt: string;
}

export interface NannyProfile {
  id: string;
  name: string;
  phone: string;
  hourlyRate: number;
  currency: string;
  maxChildren: number;
  languages: string[];
  backgroundChecked: boolean;
  firstAidCertified: boolean;
  availability: NannyAvailability[];
  isActive: boolean;
}

export interface NannyRequest {
  id: string;
  propertyId: string;
  guestName: string;
  startAt: string;
  endAt: string;
  childrenCount: number;
  childrenAges: number[];
  preferredLanguage?: string;
  specialRequirements?: string;
  status: 'pending' | 'assigned' | 'cancelled';
  assignedNannyId?: string;
  createdAt: string;
}

export class NannyOnCallService {
  private readonly nannies = new Map<string, NannyProfile>();
  private readonly requests = new Map<string, NannyRequest>();
  private requestSequence = 0;

  registerNanny(profile: NannyProfile): NannyProfile {
    this.validateWindow(profile.availability);
    this.nannies.set(profile.id, profile);
    return profile;
  }

  createRequest(request: Omit<NannyRequest, 'id' | 'status' | 'createdAt' | 'assignedNannyId'>): NannyRequest {
    this.validateWindow([{ startAt: request.startAt, endAt: request.endAt }]);

    if (request.childrenCount < 1 || request.childrenAges.length !== request.childrenCount) {
      throw new Error('childrenCount must match the number of childrenAges');
    }

    const createdRequest: NannyRequest = {
      ...request,
      id: `nanny-request-${++this.requestSequence}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.requests.set(createdRequest.id, createdRequest);
    return createdRequest;
  }

  findAvailableNannies(request: NannyRequest): NannyProfile[] {
    const requestStart = this.timestamp(request.startAt);
    const requestEnd = this.timestamp(request.endAt);

    return Array.from(this.nannies.values())
      .filter((nanny) => nanny.isActive)
      .filter((nanny) => nanny.maxChildren >= request.childrenCount)
      .filter((nanny) => !request.preferredLanguage || nanny.languages.includes(request.preferredLanguage))
      .filter((nanny) => nanny.availability.some((window) => (
        this.timestamp(window.startAt) <= requestStart && this.timestamp(window.endAt) >= requestEnd
      )))
      .sort((firstNanny, secondNanny) => firstNanny.hourlyRate - secondNanny.hourlyRate);
  }

  assignNanny(requestId: string, nannyId: string): NannyRequest {
    const request = this.requests.get(requestId);
    const nanny = this.nannies.get(nannyId);

    if (!request) {
      throw new Error(`Nanny request ${requestId} was not found`);
    }
    if (!nanny || !this.findAvailableNannies(request).some((candidate) => candidate.id === nannyId)) {
      throw new Error(`Nanny ${nannyId} is not available for this request`);
    }

    request.status = 'assigned';
    request.assignedNannyId = nannyId;
    return request;
  }

  cancelRequest(requestId: string): NannyRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Nanny request ${requestId} was not found`);
    }

    request.status = 'cancelled';
    delete request.assignedNannyId;
    return request;
  }

  getRequest(requestId: string): NannyRequest | undefined {
    return this.requests.get(requestId);
  }

  getPublicProfiles(): NannyProfile[] {
    return Array.from(this.nannies.values())
      .filter((nanny) => nanny.isActive)
      .map((nanny) => ({
        ...nanny,
        languages: [...nanny.languages],
        availability: nanny.availability.map((window) => ({ ...window })),
      }));
  }

  private validateWindow(windows: NannyAvailability[]): void {
    for (const window of windows) {
      if (this.timestamp(window.endAt) <= this.timestamp(window.startAt)) {
        throw new Error('Availability endAt must be after startAt');
      }
    }
  }

  private timestamp(value: string): number {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid date: ${value}`);
    }
    return timestamp;
  }
}

export default new NannyOnCallService();
