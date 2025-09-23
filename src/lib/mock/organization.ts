// Mock organization data for development
export const mockOrganization = {
  bio: "Mock organization bio",
  created_at: "2024-01-01T00:00:00.000Z",
  font_color: "#000000",
  logo_url: null,
  name: "Mock Organization",
  name_2: null,
  organization_id: "mock-org-id",
  slug: "mock-organization",
  theme_color: "#6366f1",
  website: null,
};

export const mockOrganizations = [mockOrganization];

export function getCurrentUser() {
  return {
    id: "mock-user-id",
    name: "Mock User",
  };
}
