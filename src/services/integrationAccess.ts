import { BookingPlatform, SUPPORTED_CHANNELS } from '../types';
import { PaymentGatewayName } from './paymentGateways';

export type IntegrationStatus = 'connected' | 'disconnected';
export type IntegrationKind = 'channel' | 'paymentGateway';

export interface IntegrationConnection {
  kind: IntegrationKind;
  id: string;
  name: string;
  status: IntegrationStatus;
  updatedAt: string;
}

export interface OwnerConnectionRequest {
  id: string;
  ownerId: string;
  kind: IntegrationKind;
  integrationId: string;
  integrationName: string;
  adminEmail: string;
  subject: string;
  body: string;
  createdAt: string;
  status: 'pending';
}

const PAYMENT_GATEWAYS: Array<{ id: string; name: PaymentGatewayName }> = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'yoco', name: 'Yoco' },
  { id: 'payfast', name: 'PayFast' },
  { id: 'ozow', name: 'Ozow' },
];

export class IntegrationAccessService {
  private readonly connections = new Map<string, IntegrationConnection>();
  private readonly requests: OwnerConnectionRequest[] = [];
  private requestSequence = 0;

  constructor(private readonly adminEmail = process.env.SCOPEBRIDGE_ADMIN_EMAIL ?? 'admin@scopebridge.app') {
    for (const channel of SUPPORTED_CHANNELS) {
      this.connections.set(this.key('channel', channel.platform), {
        kind: 'channel',
        id: channel.platform,
        name: channel.name,
        status: 'disconnected',
        updatedAt: new Date().toISOString(),
      });
    }
    for (const gateway of PAYMENT_GATEWAYS) {
      this.connections.set(this.key('paymentGateway', gateway.id), {
        kind: 'paymentGateway',
        id: gateway.id,
        name: gateway.name,
        status: 'disconnected',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  getVisibleConnections(role: 'owner' | 'admin'): IntegrationConnection[] {
    if (role !== 'owner' && role !== 'admin') throw new Error('Unsupported user role');
    return Array.from(this.connections.values()).map((connection) => ({ ...connection }));
  }

  requestConnection(
    ownerId: string,
    kind: IntegrationKind,
    integrationId: string
  ): OwnerConnectionRequest {
    if (!ownerId.trim()) throw new Error('ownerId is required');
    const connection = this.getConnection(kind, integrationId);
    const request: OwnerConnectionRequest = {
      id: `integration-request-${++this.requestSequence}`,
      ownerId,
      kind,
      integrationId,
      integrationName: connection.name,
      adminEmail: this.adminEmail,
      subject: `ScopeBridge integration request: connect ${connection.name}`,
      body: `Owner ${ownerId} requested that Admin connect ${connection.name}.`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    this.requests.push(request);
    return request;
  }

  getConnectionRequests(): OwnerConnectionRequest[] {
    return this.requests.map((request) => ({ ...request }));
  }

  connectAsAdmin(role: 'owner' | 'admin', kind: IntegrationKind, integrationId: string): IntegrationConnection {
    this.requireAdmin(role);
    return this.updateAsAdmin(kind, integrationId, 'connected');
  }

  disconnectAsAdmin(role: 'owner' | 'admin', kind: IntegrationKind, integrationId: string): IntegrationConnection {
    this.requireAdmin(role);
    return this.updateAsAdmin(kind, integrationId, 'disconnected');
  }

  private updateAsAdmin(
    kind: IntegrationKind,
    integrationId: string,
    status: IntegrationStatus
  ): IntegrationConnection {
    const connection = this.getConnection(kind, integrationId);
    connection.status = status;
    connection.updatedAt = new Date().toISOString();
    return { ...connection };
  }

  private getConnection(kind: IntegrationKind, integrationId: string): IntegrationConnection {
    const connection = this.connections.get(this.key(kind, integrationId));
    if (!connection) throw new Error(`Integration ${integrationId} was not found`);
    return connection;
  }

  private key(kind: IntegrationKind, integrationId: string): string {
    return `${kind}:${integrationId}`;
  }

  private requireAdmin(role: 'owner' | 'admin'): void {
    if (role !== 'admin') throw new Error('Only admins can change integration connections');
  }
}

export default new IntegrationAccessService();
