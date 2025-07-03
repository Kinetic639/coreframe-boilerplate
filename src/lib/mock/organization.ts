import { Tables } from "@/lib/types";

// Main organization - GCZ Grupa Cichy-Zasada
export const mockOrganization: Tables<"organizations"> = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "GCZ - Grupa Cichy-Zasada",
  name_2: "Grupa Cichy-Zasada Sp. z o.o.",
  slug: "gcz-grupa-cichy-zasada",
  created_at: "2023-01-15T00:00:00.000Z",
  created_by: "550e8400-e29b-41d4-a716-446655440000", // Jan Kowalski as founder
  deleted_at: null,
};

// Organization profile
export const mockOrganizationProfile: Tables<"organization_profiles"> = {
  organization_id: "550e8400-e29b-41d4-a716-446655440002",
  name: "GCZ - Grupa Cichy-Zasada",
  name_2: "Grupa Cichy-Zasada Sp. z o.o.",
  slug: "gcz-grupa-cichy-zasada",
  bio: "Wiodąca firma w branży lakierniczej i blacharskiej, specjalizująca się w naprawach pojazdów oraz dystrybucji materiałów lakierniczych. Działamy na rynku od 2023 roku, obsługując klientów w całej Polsce.",
  website: "https://gcz-grupa.pl",
  logo_url:
    "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=200",
  theme_color: "#1e40af",
  font_color: "#1f2937",
  created_at: "2023-01-15T00:00:00.000Z",
};

// Mock users for the organization
export const mockUsers: Tables<"users">[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "jan.kowalski@gcz-grupa.pl",
    first_name: "Jan",
    last_name: "Kowalski",
    avatar_url: "https://randomuser.me/api/portraits/men/32.jpg",
    created_at: "2023-01-15T00:00:00.000Z",
    status_id: "active",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440001", // Warsaw main
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440010",
    email: "anna.nowak@gcz-grupa.pl",
    first_name: "Anna",
    last_name: "Nowak",
    avatar_url: "https://randomuser.me/api/portraits/women/44.jpg",
    created_at: "2023-02-01T00:00:00.000Z",
    status_id: "active",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440003", // Krakow
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440011",
    email: "piotr.wisniewski@gcz-grupa.pl",
    first_name: "Piotr",
    last_name: "Wiśniewski",
    avatar_url: "https://randomuser.me/api/portraits/men/12.jpg",
    created_at: "2023-02-15T00:00:00.000Z",
    status_id: "active",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440004", // Gdansk
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440012",
    email: "maria.wojcik@gcz-grupa.pl",
    first_name: "Maria",
    last_name: "Wójcik",
    avatar_url: "https://randomuser.me/api/portraits/women/76.jpg",
    created_at: "2023-03-01T00:00:00.000Z",
    status_id: "active",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440005", // Wroclaw
    deleted_at: null,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440013",
    email: "tomasz.kaminski@gcz-grupa.pl",
    first_name: "Tomasz",
    last_name: "Kamiński",
    avatar_url: "https://randomuser.me/api/portraits/men/90.jpg",
    created_at: "2023-03-15T00:00:00.000Z",
    status_id: "active",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440001", // Warsaw main
    deleted_at: null,
  },
];

// User statuses
export const mockUserStatuses: Tables<"user_statuses">[] = [
  {
    id: "active",
    label: "Aktywny",
    slug: "active",
  },
  {
    id: "inactive",
    label: "Nieaktywny",
    slug: "inactive",
  },
  {
    id: "suspended",
    label: "Zawieszony",
    slug: "suspended",
  },
];

// Roles in the organization
export const mockRoles: Tables<"roles">[] = [
  {
    id: "org-owner",
    label: "Właściciel organizacji",
    slug: "org-owner",
    description: "Pełne uprawnienia do zarządzania organizacją",
  },
  {
    id: "branch-manager",
    label: "Kierownik oddziału",
    slug: "branch-manager",
    description: "Zarządzanie konkretnym oddziałem",
  },
  {
    id: "warehouse-manager",
    label: "Kierownik magazynu",
    slug: "warehouse-manager",
    description: "Zarządzanie magazynem i zapasami",
  },
  {
    id: "employee",
    label: "Pracownik",
    slug: "employee",
    description: "Podstawowe uprawnienia pracownika",
  },
  {
    id: "accountant",
    label: "Księgowy",
    slug: "accountant",
    description: "Dostęp do danych finansowych i księgowych",
  },
];

// User roles assignments
export const mockUserRoles: Tables<"user_roles">[] = [
  {
    id: "ur-001",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    role_id: "org-owner",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    branch_id: null, // Organization-wide role
    team_id: null,
    created_at: "2023-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "ur-002",
    user_id: "550e8400-e29b-41d4-a716-446655440010",
    role_id: "branch-manager",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    branch_id: "550e8400-e29b-41d4-a716-446655440003", // Krakow
    team_id: null,
    created_at: "2023-02-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "ur-003",
    user_id: "550e8400-e29b-41d4-a716-446655440011",
    role_id: "warehouse-manager",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    branch_id: "550e8400-e29b-41d4-a716-446655440004", // Gdansk
    team_id: null,
    created_at: "2023-02-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "ur-004",
    user_id: "550e8400-e29b-41d4-a716-446655440012",
    role_id: "accountant",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    branch_id: "550e8400-e29b-41d4-a716-446655440005", // Wroclaw
    team_id: null,
    created_at: "2023-03-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "ur-005",
    user_id: "550e8400-e29b-41d4-a716-446655440013",
    role_id: "employee",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    branch_id: "550e8400-e29b-41d4-a716-446655440001", // Warsaw
    team_id: null,
    created_at: "2023-03-15T00:00:00.000Z",
    deleted_at: null,
  },
];

// User preferences
export const mockUserPreferences: Tables<"user_preferences">[] = [
  {
    id: "up-001",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440001",
    last_branch_id: "550e8400-e29b-41d4-a716-446655440001",
    preferences: {
      theme: "light",
      language: "pl",
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      dashboard: {
        defaultView: "cards",
        itemsPerPage: 20,
      },
    },
    created_at: "2023-01-15T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "up-002",
    user_id: "550e8400-e29b-41d4-a716-446655440010",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440003",
    last_branch_id: "550e8400-e29b-41d4-a716-446655440003",
    preferences: {
      theme: "light",
      language: "pl",
      notifications: {
        email: true,
        push: false,
        sms: true,
      },
      dashboard: {
        defaultView: "list",
        itemsPerPage: 15,
      },
    },
    created_at: "2023-02-01T00:00:00.000Z",
    updated_at: "2024-01-10T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "up-003",
    user_id: "550e8400-e29b-41d4-a716-446655440011",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440004",
    last_branch_id: "550e8400-e29b-41d4-a716-446655440004",
    preferences: {
      theme: "dark",
      language: "pl",
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      dashboard: {
        defaultView: "table",
        itemsPerPage: 25,
      },
    },
    created_at: "2023-02-15T00:00:00.000Z",
    updated_at: "2024-01-05T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "up-004",
    user_id: "550e8400-e29b-41d4-a716-446655440012",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440005",
    last_branch_id: "550e8400-e29b-41d4-a716-446655440005",
    preferences: {
      theme: "light",
      language: "pl",
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
      dashboard: {
        defaultView: "cards",
        itemsPerPage: 12,
      },
    },
    created_at: "2023-03-01T00:00:00.000Z",
    updated_at: "2023-12-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "up-005",
    user_id: "550e8400-e29b-41d4-a716-446655440013",
    organization_id: "550e8400-e29b-41d4-a716-446655440002",
    default_branch_id: "550e8400-e29b-41d4-a716-446655440001",
    last_branch_id: "550e8400-e29b-41d4-a716-446655440001",
    preferences: {
      theme: "light",
      language: "pl",
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
      dashboard: {
        defaultView: "list",
        itemsPerPage: 20,
      },
    },
    created_at: "2023-03-15T00:00:00.000Z",
    updated_at: "2023-11-30T00:00:00.000Z",
    deleted_at: null,
  },
];

// Teams within branches
export const mockTeams: Tables<"teams">[] = [
  {
    id: "team-001",
    name: "Zespół Lakierniczy Warszawa",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    created_at: "2023-01-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "team-002",
    name: "Zespół Magazynowy Warszawa",
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    created_at: "2023-01-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "team-003",
    name: "Zespół Sprzedaży Kraków",
    branch_id: "550e8400-e29b-41d4-a716-446655440003",
    created_at: "2023-02-05T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "team-004",
    name: "Zespół Logistyczny Gdańsk",
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    created_at: "2023-02-20T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "team-005",
    name: "Zespół Automatyzacji Wrocław",
    branch_id: "550e8400-e29b-41d4-a716-446655440005",
    created_at: "2023-03-05T00:00:00.000Z",
    deleted_at: null,
  },
];

// Branch profiles
export const mockBranchProfiles: Tables<"branch_profiles">[] = [
  {
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Oddział Główny - Warszawa",
    slug: "warszawa-main",
    bio: "Główny oddział firmy GCZ zlokalizowany w Warszawie. Centrum zarządzania i największy magazyn produktów lakierniczych.",
    website: "https://gcz-grupa.pl/warszawa",
    logo_url:
      "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=200",
    created_at: "2023-01-15T00:00:00.000Z",
  },
  {
    branch_id: "550e8400-e29b-41d4-a716-446655440003",
    name: "Oddział Kraków",
    slug: "krakow",
    bio: "Oddział w Krakowie specjalizujący się w dystrybucji i centrum szkoleniowym dla południowej Polski.",
    website: "https://gcz-grupa.pl/krakow",
    logo_url:
      "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=200",
    created_at: "2023-02-01T00:00:00.000Z",
  },
  {
    branch_id: "550e8400-e29b-41d4-a716-446655440004",
    name: "Oddział Gdańsk",
    slug: "gdansk",
    bio: "Terminal portowy w Gdańsku obsługujący import i eksport materiałów lakierniczych dla północnej Polski.",
    website: "https://gcz-grupa.pl/gdansk",
    logo_url:
      "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=200",
    created_at: "2023-02-15T00:00:00.000Z",
  },
  {
    branch_id: "550e8400-e29b-41d4-a716-446655440005",
    name: "Oddział Wrocław",
    slug: "wroclaw",
    bio: "Nowoczesny zautomatyzowany magazyn we Wrocławiu wykorzystujący najnowsze technologie Industry 4.0.",
    website: "https://gcz-grupa.pl/wroclaw",
    logo_url:
      "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=200",
    created_at: "2023-03-01T00:00:00.000Z",
  },
];

// Helper functions
export function getUserById(userId: string): Tables<"users"> | undefined {
  return mockUsers.find((user) => user.id === userId);
}

export function getUsersByOrganization(organizationId: string): Tables<"users">[] {
  const userIds = mockUserRoles
    .filter((ur) => ur.organization_id === organizationId)
    .map((ur) => ur.user_id);

  return mockUsers.filter((user) => userIds.includes(user.id));
}

export function getUsersByBranch(branchId: string): Tables<"users">[] {
  const userIds = mockUserRoles.filter((ur) => ur.branch_id === branchId).map((ur) => ur.user_id);

  return mockUsers.filter((user) => userIds.includes(user.id));
}

export function getUserRole(
  userId: string,
  organizationId: string
): Tables<"user_roles"> | undefined {
  return mockUserRoles.find((ur) => ur.user_id === userId && ur.organization_id === organizationId);
}

export function getUserPreferences(userId: string): Tables<"user_preferences"> | undefined {
  return mockUserPreferences.find((up) => up.user_id === userId);
}

export function getTeamsByBranch(branchId: string): Tables<"teams">[] {
  return mockTeams.filter((team) => team.branch_id === branchId);
}

export function getBranchProfile(branchId: string): Tables<"branch_profiles"> | undefined {
  return mockBranchProfiles.find((bp) => bp.branch_id === branchId);
}

// Current user helper (for demo purposes)
export function getCurrentUser(): Tables<"users"> {
  return mockUsers[0]; // Jan Kowalski as default current user
}

export function getCurrentUserFullName(): string {
  const user = getCurrentUser();
  return `${user.first_name} ${user.last_name}`;
}

export function getCurrentUserInitials(): string {
  const user = getCurrentUser();
  const firstName = user.first_name || "";
  const lastName = user.last_name || "";
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getCurrentUserRole(): Tables<"user_roles"> | undefined {
  const user = getCurrentUser();
  return getUserRole(user.id, mockOrganization.id);
}
