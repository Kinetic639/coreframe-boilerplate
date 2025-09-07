/**
 * Utility functions for user data processing
 */

export const getUserInitials = (
  firstName: string | null,
  lastName: string | null,
  email: string
) => {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }
  if (lastName) {
    return lastName.charAt(0).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
};

export const getUserDisplayName = (firstName: string | null, lastName: string | null) => {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  return firstName || lastName || "User";
};
