import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getWorkspaceContext } from "@/lib/brand-data";
import { listSuppliers } from "@/lib/brand-suppliers";
import { can } from "@/lib/mode-policy";
import { SupplierList } from "./SupplierList";
import { NewSupplierButton } from "./NewSupplierButton";

export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const suppliers = await listSuppliers(ctx.workspace.id);
  const canManage = can(ctx.role, "supplier.manage", ctx.workspace.mode);

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">Suppliers</h1>
          <p className="text-[13px] text-[var(--sa-text-tertiary)] mt-1">
            Your factory network — assignable to products and to sample rounds.
          </p>
        </div>
        {canManage && (
          <NewSupplierButton
            workspaceId={ctx.workspace.id}
            workspaceSlug={slug}
            mode={ctx.workspace.mode}
            role={ctx.role}
            variant="outline"
          />
        )}
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sa-border)] bg-[var(--sa-window)] px-8 py-16 text-center">
          <Users size={28} className="mx-auto text-[var(--sa-text-tertiary)] mb-3" strokeWidth={1.5} />
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-1">Add your first supplier</h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)] mb-4 max-w-sm mx-auto">
            Every supplier here can be assigned to a product for bulk production, or overridden per sample round when your sample factory differs from your bulk one.
          </p>
          {canManage && (
            <NewSupplierButton
              workspaceId={ctx.workspace.id}
              workspaceSlug={slug}
              mode={ctx.workspace.mode}
              role={ctx.role}
              variant="primary"
            />
          )}
        </div>
      ) : (
        <SupplierList
          workspaceId={ctx.workspace.id}
          workspaceSlug={slug}
          mode={ctx.workspace.mode}
          role={ctx.role}
          suppliers={suppliers}
          canManage={canManage}
        />
      )}
    </div>
  );
}
