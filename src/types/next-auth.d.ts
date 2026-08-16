import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    companyId: string | null;
    branchId: string | null;
    roleName: string;
    permissions: string[];
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string | null;
    branchId: string | null;
    roleName: string;
    permissions: string[];
  }
}
