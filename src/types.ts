export type UserRole = 'admin' | 'visitor';

export interface User {
  id: number;
  phone: string;
  name: string;
  role: UserRole;
  displayPassword?: string;
  createdAt?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  createdAt?: string;
}

export interface Requester {
  id: number;
  name: string;
  createdAt?: string;
}

export type EDFStatus = 'Pending' | 'Partially Received' | 'Received' | 'Overdue';

export interface EDFItem {
  id?: number;
  edfId?: number;
  itemDescription: string;
  quantity: number;
  unit: string;
  status?: 'Pending' | 'Received';
  receivedAt?: string | null;
  receivedBy?: string | null;
  createdAt?: string;
}

export interface EDFStatusHistory {
  id?: number;
  edfId: number;
  edfNumber: string;
  fromStatus?: string | null;
  toStatus: EDFStatus | string;
  changedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  requesterName?: string | null;
  category?: string | null;
  materialList?: string | null;
  quantity?: number | null;
  unit?: string | null;
  currentStatus?: string | null;
  ipAddress?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  authMethod?: string | null;
  auditHash?: string | null;
}

export interface EDF {
  id: number;
  edfNumber: string;
  requesterName: string;
  category: string;
  issueDate: string;
  requiredDate: string;
  materialList: string;
  quantity: number;
  unit: string;
  status: EDFStatus;
  remarks?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isOverdue?: boolean;
  items?: EDFItem[];
  receivedItemsCount?: number;
  totalItemsCount?: number;
  statusHistory?: EDFStatusHistory[];
}

export interface ActivityLog {
  id: number;
  edfNumber?: string | null;
  action: string;
  userPhone?: string | null;
  userName?: string | null;
  createdAt: string;
}

export interface CreationDayStat {
  date: string;
  day: string;
  fullDate: string;
  count: number;
}

export interface DashboardStats {
  total: number;
  hvac: number;
  plumbing: number;
  generator: number;
  telephone: number;
  electrical: number;
  general: number;
  pending: number;
  partiallyReceived: number;
  received: number;
  overdue: number;
  recentActivity: ActivityLog[];
  creationHistory7Days?: CreationDayStat[];
  categoryDistribution: { name: string; count: number }[];
  statusDistribution: { name: string; count: number; color: string }[];
}
