export interface Product {
  id: string;
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  rating: number;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  recommendedProduct?: Product;
}

export enum CallStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  ACTIVE = 'active',
  ERROR = 'error'
}
