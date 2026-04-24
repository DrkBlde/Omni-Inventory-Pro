import { useState, useRef } from "react";
import { useAppStore, Bill } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Printer, Eye, Receipt, Calendar, User, Trash2, RotateCcw, Edit } from "lucide-react";
import { format } from "date-fns";
import { useNavigate, useLocation } from "react-router-dom";

const BillHistory = () => {
  const { bills, cancelBill, reinstateBill, hasPermission } = useAppStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmReinstateId, setConfirmReinstateId] = useState<string | null>(null);
  const [confirmEditId, setConfirmEditId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const currency = settings?.currency || '₹';

  const filtered = bills
    .filter(b => {
      const q = search.toLowerCase();
      return (
        b.billNumber.toString().includes(q) ||
        b.createdByName.toLowerCase().includes(q) ||
        (b.customerName?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handlePrint = () => {
    if (!selectedBill) return;
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;

    // Use company info stored ON the bill (captured at time of sale)
    const storeName = selectedBill.storeName || settings.storeName;
    const storeAddress = selectedBill.storeAddress || settings.storeAddress;
    const storePhone = selectedBill.storePhone || settings.storePhone;
    const gstNumber = selectedBill.gstNumber || settings.gstNumber;

    const gstBlock = selectedBill.gstPercentage > 0 ? `
      <div class="divider"></div>
      <div class="row"><span>Taxable Value</span><span>${currency}${selectedBill.taxableAmount.toFixed(2)}</span></div>
      <div class="row"><span>GST (${selectedBill.gstPercentage}%)</span><span>${currency}${selectedBill.totalGst.toFixed(2)}</span></div>
    ` : '';

    const customerRow = selectedBill.customerName
      ? `<div class="row"><span>Customer:</span><span>${selectedBill.customerName}</span></div>`
      : "";

    printWindow.document.write(`
      <html>
        <head>
          <title>Bill #${selectedBill.billNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              padding: 20px; 
              font-size: 14px; 
              color: #000; 
              background-color: #fff;
              max-width: 350px; 
              margin: auto;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
            .items th, .items td { text-align: left; padding: 4px 0; }
            .items th:last-child, .items td:last-child { text-align: right; }
            .items { width: 100%; border-collapse: collapse; margin-top: 5px; }
            h2 { font-size: 18px; }
            .small { font-size: 12px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 class="bold">${storeName}</h2>
            ${storeAddress ? `<p class="small">${storeAddress}</p>` : ''}
            ${storePhone ? `<p class="small">Ph: ${storePhone}</p>` : ''}
            ${gstNumber ? `<p class="small bold">GSTIN: ${gstNumber}</p>` : ''}
          </div>
          
          <div class="divider"></div>
          
          <div class="row"><span>Bill #:</span><span>${selectedBill.billNumber}</span></div>
          <div class="row"><span>Date:</span><span>${format(new Date(selectedBill.createdAt), "dd/MM/yyyy hh:mm a")}</span></div>
          <div class="row"><span>Cashier:</span><span>${selectedBill.createdByName}</span></div>
          ${customerRow}
          
          <div class="divider"></div>
          
          <table class="items">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Amt</th></tr>
            </thead>
            <tbody>
              ${selectedBill.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>${currency}${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${gstBlock}
          <div class="divider"></div>
          
          <div class="row bold"><span>TOTAL</span><span>${currency}${selectedBill.total.toLocaleString()}</span></div>

          <div class="divider"></div>
          
          <p class="center small" style="margin-bottom: 5px;">Payment(s):</p>
          ${selectedBill.payments.map(p => `
            <div class="row small"><span>${p.method.toUpperCase()}</span><span>${currency}${p.amount.toLocaleString()}</span></div>
          `).join('')}
          
          <div class="divider"></div>
          <p class="center small">Thank you for shopping with us!</p>
          
          ${selectedBill.isCancelled ? `
            <p class="center bold" style="margin-top: 10px; color: red;">*** CANCELLED ***</p>
          ` : ''}
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bill History</h1>
          <p className="text-sm text-muted-foreground">{bills.length} total bills</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search bill #, cashier, customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No bills found</p>
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {filtered.map(bill => (
            <GlassCard
              key={bill.id}
              className={`p-4 cursor-pointer hover:border-primary/30 transition-colors ${bill.isCancelled ? 'opacity-75 bg-destructive/5' : ''}`}
              onClick={() => setSelectedBill(bill)}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg glass flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold">Bill #{bill.billNumber}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(bill.createdAt), "dd MMM yyyy, hh:mm a")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {bill.customerName && bill.customerName !== 'Walk-in' && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {bill.customerName}
                    </div>
                  )}
                  {bill.gstPercentage > 0 && (
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      GST {bill.gstPercentage}%
                    </Badge>
                  )}
                  {bill.isCancelled ? (
                    <Badge variant="destructive">Cancelled</Badge>
                  ) : (
                    <Badge variant="secondary">{currency}{bill.total.toLocaleString()}</Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Eye className="w-4 h-4" />
                  </Button>
                  {!bill.isCancelled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        navigate('/pos', { state: { billToEdit: bill } });
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Bill Detail Dialog */}
      <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <DialogContent className="max-w-md glass-strong border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>Bill #{selectedBill?.billNumber}</span>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> 
                  <span className="hidden sm:inline">Print</span>
                </Button>

                {selectedBill && !selectedBill.isCancelled && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => {
                          // Store bill data for editing in POS
                          navigate('/pos', { state: { billToEdit: selectedBill } });
                          setSelectedBill(null);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit Bill</span>
                      </Button>

                      {confirmCancelId === selectedBill.id ? (
                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 animate-in zoom-in duration-200">
                          <span className="text-xs text-red-400 mr-1">Confirm?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => {
                              cancelBill(selectedBill.id);
                              setConfirmCancelId(null);
                              setSelectedBill(null);
                            }}
                          >
                            Yes, Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => setConfirmCancelId(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setConfirmCancelId(selectedBill.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Cancel Bill</span>
                        </Button>
                      )}
                    </>
                  )}

                {/* REINSTATE BUTTON — cancelled bills, admin only */}
                {selectedBill && selectedBill.isCancelled && hasPermission('bills.reinstate') && (
                  confirmReinstateId === selectedBill.id ? (
                    <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1 animate-in zoom-in duration-200">
                      <span className="text-xs text-green-400 mr-1">Reinstate?</span>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          reinstateBill(selectedBill.id);
                          setConfirmReinstateId(null);
                          setSelectedBill(null);
                        }}
                      >
                        Yes, Reinstate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setConfirmReinstateId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/40"
                      variant="outline"
                      onClick={() => setConfirmReinstateId(selectedBill.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reinstate</span>
                    </Button>
                  )
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedBill && (
            <div className="space-y-4 text-sm">
              {/* Store info from bill */}
              <div className="text-center border-b border-white/5 pb-3 space-y-0.5">
                <p className="font-bold">{selectedBill.storeName}</p>
                {selectedBill.storeAddress && <p className="text-xs text-muted-foreground">{selectedBill.storeAddress}</p>}
                {selectedBill.storePhone && <p className="text-xs text-muted-foreground">Ph: {selectedBill.storePhone}</p>}
                {selectedBill.gstNumber && <p className="text-xs font-mono text-primary">GSTIN: {selectedBill.gstNumber}</p>}
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>{format(new Date(selectedBill.createdAt), "dd MMM yyyy, hh:mm a")}</span>
                <span>by {selectedBill.createdByName}</span>
              </div>

              {selectedBill.isCancelled && (
                <div className="p-2 rounded bg-destructive/10 text-destructive text-center text-xs font-semibold">
                  CANCELLED {selectedBill.cancelledAt && `on ${format(new Date(selectedBill.cancelledAt), "dd MMM yyyy")}`}
                </div>
              )}

              {selectedBill.customerName && selectedBill.customerName !== 'Walk-in' && (
                <p className="text-muted-foreground">Customer: <span className="text-foreground">{selectedBill.customerName}</span></p>
              )}

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-2">Item</th>
                      <th className="text-center p-2">Qty</th>
                      <th className="text-right p-2">Price</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-right">{currency}{item.price.toLocaleString()}</td>
                        <td className="p-2 text-right">{currency}{(item.price * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedBill.gstPercentage > 0 && (
                <div className="space-y-1 text-xs text-muted-foreground border-t border-white/5 pt-2">
                  <div className="flex justify-between">
                    <span>Taxable Value</span>
                    <span>{currency}{selectedBill.taxableAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST ({selectedBill.gstPercentage}%)</span>
                    <span>{currency}{selectedBill.totalGst.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between font-bold text-base border-t border-white/5 pt-2">
                <span>Total</span>
                <span>{currency}{selectedBill.total.toLocaleString()}</span>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Payments</p>
                {selectedBill.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="capitalize">{p.method}</span>
                    <span>{currency}{p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillHistory;
