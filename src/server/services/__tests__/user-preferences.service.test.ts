/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { UserPreferencesService } from "../user-preferences.service";

describe("UserPreferencesService", () => {
  // Mock Supabase client helper
  const createMockSupabase = (config: {
    selectData?: any;
    selectError?: any;
    insertData?: any;
    insertError?: any;
    updateData?: any;
    updateError?: any;
  }) => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: config.selectData ?? null,
        error: config.selectError ?? null,
      }),
    };

    const insertChainMock = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: config.insertData ?? null,
        error: config.insertError ?? null,
      }),
    };

    const updateChainMock = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: config.updateData ?? null,
        error: config.updateError ?? null,
      }),
    };

    return {
      from: vi.fn((_table: string) => ({
        select: vi.fn().mockReturnValue(chainMock),
        insert: vi.fn().mockReturnValue(insertChainMock),
        update: vi.fn().mockReturnValue(updateChainMock),
      })),
    } as any;
  };

  // Sample user preferences row
  const samplePreferencesRow = {
    id: "pref-123",
    user_id: "user-123",
    display_name: "Test User",
    phone: "+1234567890",
    timezone: "Europe/Warsaw",
    date_format: "YYYY-MM-DD",
    time_format: "24h",
    locale: "pl",
    organization_id: "org-123",
    default_branch_id: "branch-123",
    notification_settings: { email: { enabled: true } },
    dashboard_settings: { ui: { theme: "dark" } },
    module_settings: { warehouse: { pageSize: 25 } },
    updated_at: "2026-02-01T12:00:00Z",
    updated_by: "user-123",
    deleted_at: null,
  };

  describe("getPreferences", () => {
    it("should return user preferences when found", async () => {
      const mockSupabase = createMockSupabase({
        selectData: samplePreferencesRow,
      });

      const result = await UserPreferencesService.getPreferences(mockSupabase, "user-123");

      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-123");
      expect(result?.displayName).toBe("Test User");
      expect(result?.timezone).toBe("Europe/Warsaw");
      expect(result?.dashboardSettings).toEqual({ ui: { theme: "dark" } });
    });

    it("should return null when user has no preferences (PGRST116)", async () => {
      const mockSupabase = createMockSupabase({
        selectError: { code: "PGRST116", message: "No rows found" },
      });

      const result = await UserPreferencesService.getPreferences(mockSupabase, "user-456");

      expect(result).toBeNull();
    });

    it("should throw error for database failures", async () => {
      const mockSupabase = createMockSupabase({
        selectError: { code: "500", message: "Database error" },
      });

      await expect(UserPreferencesService.getPreferences(mockSupabase, "user-123")).rejects.toThrow(
        "Failed to get user preferences"
      );
    });
  });

  describe("getOrCreatePreferences", () => {
    it("should return existing preferences when found", async () => {
      // First call returns existing preferences
      const chainMock = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: samplePreferencesRow,
          error: null,
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(chainMock),
        }),
      } as any;

      const result = await UserPreferencesService.getOrCreatePreferences(mockSupabase, "user-123");

      expect(result.userId).toBe("user-123");
      expect(result.displayName).toBe("Test User");
    });

    it("should create default preferences when not found", async () => {
      const newPrefsRow = {
        ...samplePreferencesRow,
        id: "new-pref-123",
        user_id: "user-new",
        display_name: null,
        phone: null,
      };

      // First call: getPreferences returns PGRST116 (not found)
      // Second call: insert succeeds
      let callCount = 0;
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // getPreferences call
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116", message: "No rows found" },
                }),
              }),
            };
          }
          // insert call
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: newPrefsRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.getOrCreatePreferences(mockSupabase, "user-new");

      expect(result.userId).toBe("user-new");
      expect(result.timezone).toBe("Europe/Warsaw"); // Default from row
    });
  });

  describe("updateProfile", () => {
    it("should update display name and phone", async () => {
      const updatedRow = {
        ...samplePreferencesRow,
        display_name: "Updated Name",
        phone: "+9876543210",
      };

      const mockSupabase = createMockSupabase({
        updateData: updatedRow,
      });

      const result = await UserPreferencesService.updateProfile(mockSupabase, "user-123", {
        displayName: "Updated Name",
        phone: "+9876543210",
      });

      expect(result.displayName).toBe("Updated Name");
      expect(result.phone).toBe("+9876543210");
    });

    it("should throw error on update failure", async () => {
      const mockSupabase = createMockSupabase({
        updateError: { code: "500", message: "Update failed" },
      });

      await expect(
        UserPreferencesService.updateProfile(mockSupabase, "user-123", {
          displayName: "Test",
        })
      ).rejects.toThrow("Failed to update profile");
    });
  });

  describe("updateRegionalSettings", () => {
    it("should update timezone, locale, and date/time formats", async () => {
      const updatedRow = {
        ...samplePreferencesRow,
        timezone: "America/New_York",
        locale: "en",
        date_format: "MM-DD-YYYY",
        time_format: "12h",
      };

      const mockSupabase = createMockSupabase({
        updateData: updatedRow,
      });

      const result = await UserPreferencesService.updateRegionalSettings(mockSupabase, "user-123", {
        timezone: "America/New_York",
        locale: "en",
        dateFormat: "MM-DD-YYYY",
        timeFormat: "12h",
      });

      expect(result.timezone).toBe("America/New_York");
      expect(result.locale).toBe("en");
      expect(result.dateFormat).toBe("MM-DD-YYYY");
      expect(result.timeFormat).toBe("12h");
    });
  });

  describe("updateNotificationSettings", () => {
    it("should merge notification settings with existing", async () => {
      // Setup: getPreferences returns current settings
      // Then: update with merged settings
      let callCount = 0;
      const updatedRow = {
        ...samplePreferencesRow,
        notification_settings: {
          email: { enabled: true },
          push: { enabled: false },
        },
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // getPreferences call
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: samplePreferencesRow,
                  error: null,
                }),
              }),
            };
          }
          // update call
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: updatedRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.updateNotificationSettings(
        mockSupabase,
        "user-123",
        { push: { enabled: false } }
      );

      expect(result.notificationSettings).toEqual({
        email: { enabled: true },
        push: { enabled: false },
      });
    });

    it("should throw error when preferences not found", async () => {
      const mockSupabase = createMockSupabase({
        selectError: { code: "PGRST116", message: "No rows found" },
      });

      await expect(
        UserPreferencesService.updateNotificationSettings(mockSupabase, "user-123", {})
      ).rejects.toThrow("User preferences not found");
    });
  });

  describe("updateDashboardSettings", () => {
    it("should deep merge dashboard settings", async () => {
      let callCount = 0;
      const updatedRow = {
        ...samplePreferencesRow,
        dashboard_settings: {
          ui: { theme: "dark", sidebarCollapsed: true },
          updated_at: expect.any(String),
        },
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: samplePreferencesRow,
                  error: null,
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: updatedRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.updateDashboardSettings(
        mockSupabase,
        "user-123",
        { ui: { theme: "dark", sidebarCollapsed: true } }
      );

      expect(result.dashboardSettings.ui).toMatchObject({
        theme: "dark", // Original preserved
        sidebarCollapsed: true, // New value merged
      });
    });
  });

  describe("updateModuleSettings", () => {
    it("should update settings for specific module", async () => {
      let callCount = 0;
      const updatedRow = {
        ...samplePreferencesRow,
        module_settings: {
          warehouse: { pageSize: 50, sortField: "name" },
        },
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: samplePreferencesRow,
                  error: null,
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: updatedRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.updateModuleSettings(
        mockSupabase,
        "user-123",
        "warehouse",
        { pageSize: 50, sortField: "name" }
      );

      expect(result.moduleSettings.warehouse).toMatchObject({
        pageSize: 50,
        sortField: "name",
      });
    });
  });

  describe("syncUiSettings", () => {
    it("should sync UI settings from localStorage to DB", async () => {
      let callCount = 0;
      const updatedRow = {
        ...samplePreferencesRow,
        dashboard_settings: {
          ui: { theme: "light", sidebarCollapsed: true },
          updated_at: "2026-02-01T14:00:00Z",
        },
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: samplePreferencesRow,
                  error: null,
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: updatedRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.syncUiSettings(mockSupabase, "user-123", {
        theme: "light",
        sidebarCollapsed: true,
        clientUpdatedAt: "2026-02-01T14:00:00Z",
      });

      expect(result.dashboardSettings.ui?.theme).toBe("light");
      expect(result.dashboardSettings.ui?.sidebarCollapsed).toBe(true);
    });
  });

  describe("getDashboardSettings", () => {
    it("should return dashboard settings only", async () => {
      const chainMock = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { dashboard_settings: { ui: { theme: "dark" } } },
          error: null,
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(chainMock),
        }),
      } as any;

      const result = await UserPreferencesService.getDashboardSettings(mockSupabase, "user-123");

      expect(result).toEqual({ ui: { theme: "dark" } });
    });

    it("should return null when user has no preferences", async () => {
      const chainMock = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "No rows found" },
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(chainMock),
        }),
      } as any;

      const result = await UserPreferencesService.getDashboardSettings(mockSupabase, "user-456");

      expect(result).toBeNull();
    });

    it("should return empty object when dashboard_settings is null", async () => {
      const chainMock = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { dashboard_settings: null },
          error: null,
        }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(chainMock),
        }),
      } as any;

      const result = await UserPreferencesService.getDashboardSettings(mockSupabase, "user-123");

      expect(result).toEqual({});
    });
  });

  describe("setDefaultOrganization", () => {
    it("should update organization when user is a member", async () => {
      const updatedRow = {
        ...samplePreferencesRow,
        organization_id: "org-456",
        default_branch_id: null, // Cleared when org changes
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "organization_members") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: "membership-123" },
                  error: null,
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: updatedRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.setDefaultOrganization(
        mockSupabase,
        "user-123",
        "org-456"
      );

      expect(result.organizationId).toBe("org-456");
      expect(result.defaultBranchId).toBeNull();
    });

    it("should throw error when user is not an org member", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "organization_members") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116", message: "No rows found" },
                }),
              }),
            };
          }
          return {};
        }),
      } as any;

      await expect(
        UserPreferencesService.setDefaultOrganization(mockSupabase, "user-123", "org-456")
      ).rejects.toThrow("You are not a member of this organization");
    });
  });

  describe("setDefaultBranch", () => {
    it("should update default branch when valid", async () => {
      const updatedRow = {
        ...samplePreferencesRow,
        default_branch_id: "branch-456",
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: "branch-456", organization_id: "org-123" },
                  error: null,
                }),
              }),
            };
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: updatedRow,
                error: null,
              }),
            }),
          };
        }),
      } as any;

      const result = await UserPreferencesService.setDefaultBranch(
        mockSupabase,
        "user-123",
        "branch-456"
      );

      expect(result.defaultBranchId).toBe("branch-456");
    });

    it("should throw error when branch not found", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "branches") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116", message: "No rows found" },
                }),
              }),
            };
          }
          return {};
        }),
      } as any;

      await expect(
        UserPreferencesService.setDefaultBranch(mockSupabase, "user-123", "branch-999")
      ).rejects.toThrow("Branch not found");
    });
  });
});
