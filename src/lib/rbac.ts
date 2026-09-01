export const ROLES = [
  "super_admin",
  "owner",
  "admin",
  "accountant",
  "manager",
  "staff",
  "viewer",
] as const;

export type AppRole = (typeof ROLES)[number];

/** Higher number = more power. */
export const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 70,
  owner: 60,
  admin: 50,
  accountant: 40,
  manager: 30,
  staff: 20,
  viewer: 10,
};

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export type Permission =
  | "company.manage"
  | "company.create"
  | "branch.manage"
  | "member.manage"
  | "accounting.post"
  | "accounting.view"
  | "sales.manage"
  | "reports.view";

const MIN_RANK: Record<Permission, number> = {
  "company.manage": ROLE_RANK.admin,
  "company.create": ROLE_RANK.viewer,
  "branch.manage": ROLE_RANK.admin,
  "member.manage": ROLE_RANK.admin,
  "accounting.post": ROLE_RANK.accountant,
  "accounting.view": ROLE_RANK.viewer,
  "sales.manage": ROLE_RANK.manager,
  "reports.view": ROLE_RANK.viewer,
};

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= MIN_RANK[permission];
}

export function atLeast(role: AppRole | null | undefined, minimum: AppRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
