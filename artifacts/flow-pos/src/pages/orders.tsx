import { useState } from "react";
import { useListOrders, useGetOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Search, Eye, X, ClipboardList } from "lucide-react";

function formatRp(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  completed: { label: "Selesai", cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  pending: { label: "Pending", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  cancelled: { label: "Dibatalkan", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  refunded: { label: "Refund", cls: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
};

const PAY_MAP: Record<string, string> = {
  cash: "Tunai", qris: "QRIS", bank_transfer: "Transfer Bank", ewallet: "E-Wallet", credit_card: "Kartu Kredit"
};

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: order, isLoading } = useGetOrder(id, { query: { queryKey: ["order", id] } });
  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-2xl p-8 text-muted-foreground">Memuat...</div>
    </div>
  );
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Detail Transaksi</h2>
            <p className="text-xs text-muted-foreground font-mono">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Status</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[order.status]?.cls}`}>
                {STATUS_MAP[order.status]?.label}
              </span>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Metode Bayar</div>
              <div className="font-medium">{PAY_MAP[order.paymentMethod] || order.paymentMethod}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Waktu</div>
              <div className="font-medium">{new Date(order.createdAt).toLocaleString("id-ID")}</div>
            </div>
            {order.customerName && <div>
              <div className="text-muted-foreground text-xs">Pelanggan</div>
              <div className="font-medium">{order.customerName}</div>
            </div>}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground mb-2">Item Pesanan</div>
            <div className="space-y-2">
              {(order.items || []).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                  <div>
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">{item.quantity} x {formatRp(item.price)}</div>
                  </div>
                  <div className="font-semibold">{formatRp(item.subtotal)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatRp(order.subtotal ?? 0)}</span></div>
            {(order.discount ?? 0) > 0 && <div className="flex justify-between text-muted-foreground"><span>Diskon</span><span>-{formatRp(order.discount ?? 0)}</span></div>}
            {(order.tax ?? 0) > 0 && <div className="flex justify-between text-muted-foreground"><span>Pajak</span><span>{formatRp(order.tax ?? 0)}</span></div>}
            <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border"><span>Total</span><span className="text-primary">{formatRp(order.total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListOrders({ status: statusFilter || undefined, page, limit: 20 });
  const orders = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Transaksi</h1>
          <p className="text-muted-foreground text-sm">{data?.total || 0} total transaksi</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari no. order..."
            className="pl-9 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["No. Order", "Total", "Metode", "Pelanggan", "Kasir", "Status", "Waktu", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-12">
                    <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                    <div>Belum ada transaksi</div>
                  </td></tr>
                )}
                {orders.filter(o => !search || o.orderNumber.includes(search)).map(o => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3 font-bold text-primary">{formatRp(o.total)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{PAY_MAP[o.paymentMethod] || o.paymentMethod}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customerName || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.employeeName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[o.status]?.cls}`}>
                        {STATUS_MAP[o.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(o.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewId(o.id)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40">Sebelumnya</button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">Hal. {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= data.total} className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40">Selanjutnya</button>
        </div>
      )}

      {viewId && <OrderDetail id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}
