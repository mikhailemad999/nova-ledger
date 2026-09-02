import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyWorkspace, switchTenant } from "@/lib/tenant.functions";
import type { AppRole } from "@/lib/rbac";

const COMPANY_KEY = "erp.activeCompany";
const BRANCH_KEY = "erp.activeBranch";

export type TenantCompany = { id: string; name: string; currency: string; role: AppRole };
export type TenantBranch = { id: string; company_id: string; name: string; code: string; is_active: boolean };

type TenantValue = {
  loading: boolean;
  profile: { id: string; full_name: string | null; email: string | null } | null;
  companies: TenantCompany[];
  branches: TenantBranch[];
  company: TenantCompany | null;
  branch: TenantBranch | null;
  role: AppRole | null;
  setCompany: (companyId: string) => Promise<void>;
  setBranch: (branchId: string | null) => Promise<void>;
  refresh: () => void;
};

const TenantContext = createContext<TenantValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const fetchWorkspace = useServerFn(getMyWorkspace);
  const doSwitch = useServerFn(switchTenant);
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace({}),
  });

  useEffect(() => {
    setCompanyId(localStorage.getItem(COMPANY_KEY));
    setBranchId(localStorage.getItem(BRANCH_KEY));
  }, []);

  const companies = (data?.companies ?? []) as TenantCompany[];
  const company = companies.find((c: TenantCompany) => c.id === companyId) ?? companies[0] ?? null;
  const allBranches = (data?.branches ?? []) as TenantBranch[];
  const branches = allBranches.filter((b: TenantBranch) => b.company_id === company?.id);
  const branch = branches.find((b: TenantBranch) => b.id === branchId) ?? null;

  const setCompany = useCallback(
    async (id: string) => {
      await doSwitch({ data: { companyId: id, branchId: null } });
      localStorage.setItem(COMPANY_KEY, id);
      localStorage.removeItem(BRANCH_KEY);
      setCompanyId(id);
      setBranchId(null);
      queryClient.invalidateQueries();
    },
    [doSwitch, queryClient],
  );

  const setBranch = useCallback(
    async (id: string | null) => {
      if (!company) return;
      await doSwitch({ data: { companyId: company.id, branchId: id } });
      if (id) localStorage.setItem(BRANCH_KEY, id);
      else localStorage.removeItem(BRANCH_KEY);
      setBranchId(id);
      queryClient.invalidateQueries();
    },
    [company, doSwitch, queryClient],
  );

  const value = useMemo<TenantValue>(
    () => ({
      loading: isLoading,
      profile: (data?.profile as TenantValue["profile"]) ?? null,
      companies,
      branches,
      company,
      branch,
      role: company?.role ?? null,
      setCompany,
      setBranch,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    }),
    [isLoading, data, companies, branches, company, branch, setCompany, setBranch, queryClient],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside TenantProvider");
  return ctx;
}

export function useOptionalTenant() {
  return useContext(TenantContext);
}
