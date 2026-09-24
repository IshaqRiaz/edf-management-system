export interface MaterialItem {
  id?: number;
  edfId?: number;
  materialName: string;
  quantity: string;
  unit: string;
  description?: string;
  status?: string;
}

export interface AttachmentItem {
  id?: number;
  edfId?: number;
  fileName: string;
  fileType: string;
  fileSize?: number;
  fileUrl?: string;
  uploadedAt?: string;
}

export interface Category {
  id: number;
  categoryName: string;
  description?: string;
  color?: string;
  icon?: string;
  active: boolean;
  createdAt?: string;
}

export type EDFStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending'
  | 'Partially Received'
  | 'Received'
  | 'Completed'
  | 'Overdue';

export type EDFPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface EDF {
  id: number;
  edfNumber: string;
  categoryId?: number | null;
  categoryName: string;
  requestDescription?: string;
  requestDate: string; // YYYY-MM-DD
  requiredDate: string; // ISO string or YYYY-MM-DDTHH:mm
  expectedDate?: string | null;
  requestingTeam: string;
  status: EDFStatus;
  priority: EDFPriority;
  remarks?: string;
  receivedDate?: string | null;
  completedDate?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  materials?: MaterialItem[];
  attachments?: AttachmentItem[];
  materialCount?: number;
  attachmentCount?: number;
}

export interface DashboardStats {
  total: number;
  pending: number;
  received: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  receivedOrCompleted: number;
  categoryCounts: Record<string, number>;
  totalMaterials: number;
  monthlyMap: Record<string, { total: number; completed: number; overdue: number }>;
}

export interface ExtractedEdfData {
  edfNumber: string;
  category: string;
  confidence: 'High' | 'Medium' | 'Low';
  categoryReasoning: string;
  requestDescription: string;
  requestingTeam: string;
  requestDate: string;
  requiredDate: string;
  expectedDate?: string;
  priority: EDFPriority;
  remarks: string;
  materials: {
    materialName: string;
    quantity: string;
    unit: string;
    description?: string;
  }[];
}

export interface ActivityItem {
  id: number;
  action: 'created' | 'status_changed' | 'updated' | 'deleted' | 'bulk_status_changed' | 'bulk_deleted' | 'imported';
  title: string;
  description?: string | null;
  edfId?: number | null;
  edfNumber?: string | null;
  status?: string | null;
  user?: string | null;
  createdAt?: string | null;
}
