// utils/getUserRolesFromJWT.ts
import { jwtDecode } from "jwt-decode";

export type UserRole = {
  branch_id: string | null;
  org_id: string | null;
  role: string;
  team_id: string | null;
};

type DecodedJWT = {
  roles?: UserRole[];
};

export function getUserRolesFromJWT(accessToken: string): UserRole[] {
  try {
    const decoded = jwtDecode<DecodedJWT>(accessToken);
    return decoded.roles || [];
  } catch (error) {
    console.error("JWT decode failed:", error);
    return [];
  }
}
