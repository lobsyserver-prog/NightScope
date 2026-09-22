import { describe, expect, it } from 'vitest';
import { IntegrationAccessService } from '../services/integrationAccess';

describe('IntegrationAccessService', () => {
  it('shows owners channel and payment status without edit access', () => {
    const service = new IntegrationAccessService('admin@example.com');
    const visibleToOwner = service.getVisibleConnections('owner');

    expect(visibleToOwner).toHaveLength(12);
    expect(visibleToOwner.every((connection) => connection.status === 'disconnected')).toBe(true);
    expect(() => service.connectAsAdmin('owner', 'channel', 'airbnb')).toThrow('Only admins');
    expect(() => service.disconnectAsAdmin('owner', 'paymentGateway', 'stripe')).toThrow('Only admins');
  });

  it('creates admin requests for owner-selected channels and gateways', () => {
    const service = new IntegrationAccessService('admin@example.com');
    const channelRequest = service.requestConnection('owner-1', 'channel', 'airbnb');
    const paymentRequest = service.requestConnection('owner-1', 'paymentGateway', 'stripe');

    expect(channelRequest).toMatchObject({ adminEmail: 'admin@example.com', integrationName: 'Airbnb', status: 'pending' });
    expect(paymentRequest).toMatchObject({ adminEmail: 'admin@example.com', integrationName: 'Stripe', status: 'pending' });
    expect(service.getConnectionRequests()).toHaveLength(2);
  });

  it('lets Admin connect and disconnect integrations, visible to owners', () => {
    const service = new IntegrationAccessService();

    expect(service.connectAsAdmin('admin', 'channel', 'airbnb').status).toBe('connected');
    expect(service.getVisibleConnections('owner').find((connection) => connection.id === 'airbnb')?.status).toBe('connected');
    expect(service.disconnectAsAdmin('admin', 'channel', 'airbnb').status).toBe('disconnected');
  });
});
