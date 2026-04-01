// utils/getUserRolesFromJWT.ts

import { UserRoleFromToken } from "@/lib/types/user";
import { jwtDecode } from "jwt-decode";

type DecodedJWT = {
  roles?: UserRoleFromToken[];
};

export function getUserRolesFromJWT(accessToken: string): UserRoleFromToken[] {
  try {
    const decoded = jwtDecode<DecodedJWT>(accessToken);
    return decoded.roles || [];
  } catch (error) {
    console.error("JWT decode failed:", error);
    return [];
  }
}
