import { useState, useRef, useEffect } from "react";
import { useAppStore, Bill, resetSyncLock } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Printer, Receipt, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { QRScannerModal } from "@/components/QRScannerModal";
import { decryptAES256, generateBillCancellationQRCode } from "@/lib/cryptoUtils";
import { useToast } from "@/hooks/use-toast";

const BillHistory = () => {
  const bills = useAppStore((state) => state.bills);
  const cancelBill = useAppStore((state) => state.cancelBill);
  const reinstateBill = useAppStore((state) => state.reinstateBill);
  const hasPermission = useAppStore((state) => state.hasPermission);
  const refreshFromServer = useAppStore((state) => state.refreshFromServer);
  const { settings } = useSettingsStore();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  const hasSynced = useRef(false);

  useEffect(() => {
    const forceSync = async () => {
      // 1. Reset the internal store lock
      resetSyncLock();
      
      try {
        // 2. Fetch fresh data
        if (refreshFromServer) {
          await refreshFromServer();

        }
      } catch (err) {
        console.error("Manual sync failed", err);
      }
    };

    forceSync();
  }, []); // Only runs when you open the page

  useEffect(() => {
    const getQR = async () => {
      if (selectedBill) {
        try {
          const numericId = parseInt(String(selectedBill.billNumber).replace(/\D/g, ''), 10) || 0;
          const url = await generateBillCancellationQRCode(selectedBill.id, numericId);
          setQrCodeUrl(url);
        } catch (err) {
          setQrCodeUrl("");
        }
      }
    };
    getQR();
  }, [selectedBill]);

  const currency = settings?.currency || '₹';
  
  const getCustomerDisplay = (bill: any) => {
    if (!bill) return "Walk-in";
    if (bill.customerName && bill.customerName.toLowerCase() !== "walk-in") return bill.customerName;
    if (bill.customer && typeof bill.customer === 'object' && bill.customer.name) return bill.customer.name;
    if (typeof bill.customer === 'string' && bill.customer.trim().length > 0 && bill.customer.toLowerCase() !== "walk-in") return bill.customer;
    return "Walk-in";
  };

  const filtered = (bills || [])
    .filter(b => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        b.billNumber?.toString().toLowerCase().includes(q) ||
        getCustomerDisplay(b).toLowerCase().includes(q) ||
        (b.createdByName?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handlePrint = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedBill) return;

    // Always generate QR fresh at print time so it's ready before the window opens
    let printQrUrl = qrCodeUrl;
    if (!printQrUrl) {
      try {
        const numericId = parseInt(String(selectedBill.billNumber).replace(/\D/g, ''), 10) || 0;
        printQrUrl = await generateBillCancellationQRCode(selectedBill.id, numericId);
      } catch {
        printQrUrl = "";
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isNormal = (selectedBill as any).billType === 'Normal';
    const totalAmount = selectedBill.total || 0;
    const gstRate = selectedBill.gstPercentage || 0;
    
    // Logic: If Normal, display price as is. If GST, show tax-exclusive price.
    const taxableAmount = selectedBill.taxableAmount || (totalAmount / (1 + (gstRate / 100)));
    const totalGst = selectedBill.totalGst || (totalAmount - taxableAmount);

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Bill#${selectedBill.billNumber}</title>
            <style>
              body { 
                font-family: 'Courier New', Courier, monospace; 
                width: 75mm; 
                padding: 8mm; 
                color: black; 
                background: white; 
                margin: 0; 
                line-height: 1.6;
              }
              .text-center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-top: 2.5px dashed black; margin: 15px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th { border-bottom: 2px solid black; text-align: left; font-size: 15px; padding: 10px 0; }
              td { font-size: 14px; padding: 12px 0; vertical-align: top; }
              .row { display: flex; justify-content: space-between; font-size: 15px; margin-top: 10px; }
              .grand-total { 
                  font-size: 22px; 
                  border-top: 3px solid black; 
                  padding-top: 15px; 
                  margin-top: 15px;
                  letter-spacing: -1px;
              }
              .qr-container { text-align: center; margin-top: 35px; }
              img { width: 120px; height: 120px; }
              @page { margin: 0; }
            </style>
          </head>
          <body>
            <div class="text-center">
              <div class="bold" style="font-size: 24px; margin-bottom: 8px;">${settings.storeName}</div>
              <div style="font-size: 14px;">${settings.storeAddress}</div>
              <div style="font-size: 14px;">Ph: ${settings.storePhone}</div>
              ${!isNormal && settings.gstNumber ? `<div style="font-size: 14px; font-weight: bold; margin-top: 8px;">GSTIN: ${settings.gstNumber}</div>` : ''}
            </div>

            <div class="divider"></div>
            <div style="font-size: 14px;">
              <div>INV NO: ${selectedBill.billNumber}</div>
              <div>DATE  : ${format(new Date(selectedBill.createdAt), "dd/MM/yyyy HH:mm")}</div>
              <div class="bold">CUST  : ${getCustomerDisplay(selectedBill)}</div>
            </div>
            <div class="divider"></div>

            <table>
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th style="text-align:center">QTY</th>
                  <th style="text-align:right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${selectedBill.items.map(item => {
                  const displayPrice = isNormal ? item.price : (item.price / (1 + (gstRate / 100)));
                  return `
                  <tr>
                    <td style="text-transform:uppercase; font-weight: bold;">${item.name}</td>
                    <td style="text-align:center">${item.quantity}</td>
                    <td style="text-align:right">${currency}${(displayPrice * item.quantity).toFixed(2)}</td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>

            <div class="divider"></div>
            ${!isNormal ? `
              <div class="row"><span>Taxable:</span><span>${currency}${taxableAmount.toFixed(2)}</span></div>
              <div class="row"><span>Total GST (${gstRate}%):</span><span>${currency}${totalGst.toFixed(2)}</span></div>
            ` : `
              <div class="row"><span>Total:</span><span>${currency}${Math.round(totalAmount)}.00</span></div>
            `}
            
            <div class="row bold grand-total">
              <span>NET AMOUNT:</span>
              <span>${currency}${Math.round(totalAmount)}.00</span>
            </div>

            <div class="qr-container">
              ${printQrUrl ? `<img src="${printQrUrl}" alt="QR">` : ''}
              <div style="font-size: 13px; margin-top: 15px; font-weight: bold;">*** DUPLICATE COPY ***</div>
              <div style="font-size: 11px; margin-top: 5px;">Ref: ${selectedBill.id.substring(0,8)}</div>
            </div>

            <script>
              window.onload = () => {
                document.title = "Bill#${selectedBill.billNumber}";
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
    printWindow.document.close();
  };

  const handleQRScanResult = async (scannedText: string) => {
    if (!cancellingBill) return;
    try {
      if (!scannedText.startsWith('aes256:')) {
        if (window.confirm("Admin override?")) {
          await cancelBill(cancellingBill.id);
          setQrScannerOpen(false);
          setSelectedBill(null);
        }
        return;
      }
      const decrypted = await decryptAES256(scannedText);
      const payload = JSON.parse(decrypted);
      if (payload.billId === cancellingBill.id) {
        await cancelBill(payload.billId);
        setQrScannerOpen(false);
        setSelectedBill(null);
        toast({ title: "Bill Cancelled" });
      }
    } catch (err) {
      toast({ title: "Scan Error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bill History</h1>
          <p className="text-sm text-muted-foreground">{bills?.length || 0} bills found</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No bills found.</div>
        ) : (
          filtered.map(bill => (
            <GlassCard
              key={bill.id}
              className={`p-4 cursor-pointer hover:border-primary/30 transition-all ${bill.isCancelled ? 'opacity-60 bg-destructive/5' : ''}`}
              onClick={() => setSelectedBill(bill)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-full"><Receipt className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="font-bold">#{bill.billNumber}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(bill.createdAt), "dd MMM, hh:mm a")}</p>
                    <p className="text-[10px] text-primary font-bold uppercase">{getCustomerDisplay(bill)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{currency}{bill.total.toLocaleString()}</p>
                  {bill.isCancelled && <Badge variant="destructive" className="text-[10px]">CANCELLED</Badge>}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-2xl bg-zinc-950 border-white/10 max-h-[90vh] overflow-y-auto p-0 shadow-2xl [&>button]:right-6 [&>button]:top-6 [&>button]:text-zinc-400 [&>button]:hover:text-white [&>button]:focus:ring-0 [&>button]:scale-125">
          <DialogHeader className="p-6 bg-zinc-900/50 border-b border-white/5">
            <div className="flex items-center justify-between pr-10">
              <div>
                <DialogTitle className="text-xl font-bold text-white">Bill Details</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 mt-1">
                  Full summary for Invoice #{selectedBill?.billNumber}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                  <Printer size={14} /> Print Receipt
                </Button>
                {selectedBill && !selectedBill.isCancelled && (
                  <Button variant="destructive" size="sm" onClick={() => { setCancellingBill(selectedBill); setQrScannerOpen(true); }}>Cancel Bill</Button>
                )}
                {selectedBill?.isCancelled && hasPermission('bills.reinstate') && (
                  <Button variant="outline" size="sm" onClick={() => { reinstateBill(selectedBill.id); setSelectedBill(null); }}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reinstate
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {selectedBill && (
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Customer</p>
                  <p className="text-white font-bold text-lg">{getCustomerDisplay(selectedBill)}</p>
                  {selectedBill.customerPhone && <p className="text-xs text-zinc-400 mt-0.5">{selectedBill.customerPhone}</p>}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Cashier</p>
                  <p className="text-white font-bold text-lg">{selectedBill.createdByName || "System Administrator"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Cart Items</p>
                <div className="rounded-xl border border-white/5 overflow-hidden bg-white/5">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-zinc-400 text-[11px] uppercase font-bold">
                      <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-center">Qty</th><th className="px-4 py-3 text-right">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedBill.items.map((item, i) => {
                        const isNormal = (selectedBill as any).billType === 'Normal';
                        const displayPrice = isNormal ? item.price : (item.price / (1 + (selectedBill.gstPercentage! / 100)));
                        return (
                          <tr key={i} className="text-zinc-300">
                            <td className="px-4 py-4">
                              <p className="font-bold text-white uppercase">{item.name}</p>
                              <p className="text-[10px] text-zinc-500 mt-0.5">BATCH: {item.batchNo || 'N/A'}</p>
                            </td>
                            <td className="px-4 py-4 text-center font-mono">{item.quantity}</td>
                            <td className="px-4 py-4 text-right font-bold text-white">
                              {currency}{(displayPrice * item.quantity).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 space-y-2">
                {/* CONDITIONAL TAX SUMMARY UI */}
                {(selectedBill as any).billType !== 'Normal' ? (
                  <>
                    <div className="flex justify-between text-zinc-400 text-sm">
                      <span>Taxable Amount</span>
                      <span>{currency}{(selectedBill.taxableAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 text-sm">
                      <span>Total GST ({selectedBill.gstPercentage}%)</span>
                      <span>{currency}{(selectedBill.totalGst || 0).toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-zinc-400 text-sm">
                    <span>Total</span>
                    <span>{currency}{Math.round(selectedBill.total).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-white text-2xl font-black pt-4 border-t-2 border-white/5 border-double mt-4">
                  <span>Grand Total</span>
                  <span className="text-primary">{currency}{Math.round(selectedBill.total).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-center pt-6 opacity-20 hover:opacity-100 transition-opacity">
                <p className="text-[9px] uppercase font-mono tracking-[0.2em] text-center">
                    Internal System Receipt Reference: {selectedBill.id}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QRScannerModal
        isOpen={qrScannerOpen}
        onOpenChange={(open) => { setQrScannerOpen(open); if (!open) setCancellingBill(null); }}
        onScanSuccess={handleQRScanResult}
        cancellingBillNumber={parseInt(String(cancellingBill?.billNumber).replace(/\D/g, ''), 10) || 0}
      />
    </div>
  );
};

export default BillHistory;