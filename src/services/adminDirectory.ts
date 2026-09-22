import { BookingPlatform, SUPPORTED_CHANNELS } from '../types';
import { PaymentGatewayName } from './paymentGateways';

export type DirectoryNodeType = 'user' | 'property' | 'vehicle' | 'shuttle' | 'channel' | 'paymentGateway';

export interface DirectoryNode {
  id: string;
  type: DirectoryNodeType;
  name: string;
  status: string;
  children: DirectoryNode[];
}

export interface DirectoryProfile {
  userId: string;
  name: string;
  status: 'active' | 'pending' | 'suspended';
  properties: DirectoryNode[];
}

export class AdminDirectoryService {
  private readonly profiles = new Map<string, DirectoryProfile>();
  private readonly channels = new Map<BookingPlatform, DirectoryNode>();
  private readonly paymentGateways = new Map<string, DirectoryNode>();

  constructor() {
    for (const channel of SUPPORTED_CHANNELS) {
      this.channels.set(channel.platform, { id: channel.platform, type: 'channel', name: channel.name, status: channel.isActive ? 'active' : 'inactive', children: [] });
    }
    const gateways: PaymentGatewayName[] = ['Stripe', 'Yoco', 'PayFast', 'Ozow', 'Paystack', 'Pay at property'];
    gateways.forEach((name) => {
      this.paymentGateways.set(name, { id: name.toLowerCase().replaceAll(' ', '-'), type: 'paymentGateway', name, status: 'disconnected', children: [] });
    });
  }

  registerProfile(userId: string, name: string, status: DirectoryProfile['status'] = 'active'): DirectoryProfile {
    if (!userId.trim() || !name.trim()) throw new Error('User ID and name are required');
    if (this.profiles.has(userId)) throw new Error(`Profile ${userId} is already registered`);
    const profile = { userId, name, status, properties: [] };
    this.profiles.set(userId, profile);
    return profile;
  }

  addProperty(userId: string, propertyId: string, propertyName: string): DirectoryNode {
    const profile = this.requireProfile(userId);
    const property = this.createNode(propertyId, 'property', propertyName, 'active');
    profile.properties.push(property);
    return property;
  }

  addVehicle(userId: string, propertyId: string, vehicleId: string, vehicleName: string, status = 'pending'): DirectoryNode {
    return this.addChild(userId, propertyId, this.createNode(vehicleId, 'vehicle', vehicleName, status));
  }

  addShuttle(userId: string, propertyId: string, shuttleId: string, shuttleName: string, status = 'pending'): DirectoryNode {
    return this.addChild(userId, propertyId, this.createNode(shuttleId, 'shuttle', shuttleName, status));
  }

  setChannelStatus(role: 'admin', platform: BookingPlatform, status: 'connected' | 'disconnected'): DirectoryNode {
    if (role !== 'admin') throw new Error('Only admins can update directory integration status');
    const channel = this.channels.get(platform);
    if (!channel) throw new Error(`Channel ${platform} was not found`);
    channel.status = status;
    return { ...channel, children: [] };
  }

  setPaymentGatewayStatus(role: 'admin', gatewayName: PaymentGatewayName, status: 'connected' | 'disconnected'): DirectoryNode {
    if (role !== 'admin') throw new Error('Only admins can update directory integration status');
    const gateway = this.paymentGateways.get(gatewayName);
    if (!gateway) throw new Error(`Payment gateway ${gatewayName} was not found`);
    gateway.status = status;
    return { ...gateway, children: [] };
  }

  getTree(role: 'admin'): DirectoryNode[] {
    if (role !== 'admin') throw new Error('Only admins can view the directory tree');
    return Array.from(this.profiles.values()).map((profile) => ({
      id: profile.userId,
      type: 'user',
      name: profile.name,
      status: profile.status,
      children: profile.properties.map((property) => this.copyNode(property)),
    }));
  }

  getIntegrationNodes(role: 'admin'): DirectoryNode[] {
    if (role !== 'admin') throw new Error('Only admins can view integration nodes');
    return [...Array.from(this.channels.values()), ...Array.from(this.paymentGateways.values())].map((node) => ({ ...node, children: [] }));
  }

  private addChild(userId: string, propertyId: string, child: DirectoryNode): DirectoryNode {
    const profile = this.requireProfile(userId);
    const property = profile.properties.find((candidate) => candidate.id === propertyId);
    if (!property) throw new Error(`Property ${propertyId} was not found`);
    property.children.push(child);
    return child;
  }

  private requireProfile(userId: string): DirectoryProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new Error(`Profile ${userId} was not found`);
    return profile;
  }

  private createNode(id: string, type: DirectoryNodeType, name: string, status: string): DirectoryNode {
    if (!id.trim() || !name.trim()) throw new Error('Directory item ID and name are required');
    return { id, type, name, status, children: [] };
  }

  private copyNode(node: DirectoryNode): DirectoryNode {
    return { ...node, children: node.children.map((child) => this.copyNode(child)) };
  }
}

export default new AdminDirectoryService();
