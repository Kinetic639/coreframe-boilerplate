export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  addToSidebar: boolean;
  isPublic: boolean;
  filters: {
    search?: string;
    type?: string;
    availability?: string;
    service?: string;
  };
  userId: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}
