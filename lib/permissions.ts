import { useOrganization } from "./hooks/use-organization";

export async function isAdmin() {
    const org = await useOrganization();
    if (!org) return false;

    // @ts-ignore (We'll type organizations later)
    return org.role === 'admin';
}

export async function isEditor() {
    const org = await useOrganization();
    if (!org) return false;

    // @ts-ignore
    return org.role === 'editor' || org.role === 'admin';
}

export async function requireAdmin() {
    const admin = await isAdmin();
    if (!admin) {
        throw new Error("Unauthorized: Administrator status required for this action.");
    }
    return true;
}
