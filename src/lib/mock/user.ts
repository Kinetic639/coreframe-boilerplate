import {
  mockUsers,
  mockOrganization,
  getCurrentUser,
  getCurrentUserFullName,
  getCurrentUserInitials,
  getCurrentUserRole,
} from "./organization";

// Re-export for backward compatibility
export const mockUser = getCurrentUser();
export { mockOrganization };

// Re-export branch data
export { mockBranches } from "./branches";

export const mockUserFullName = getCurrentUserFullName;
export const mockUserInitials = getCurrentUserInitials;

// Additional user utilities
export function getAllUsers() {
  return mockUsers;
}

export function getCurrentUserWithRole() {
  const user = getCurrentUser();
  const role = getCurrentUserRole();

  return {
    ...user,
    role: role,
  };
}
