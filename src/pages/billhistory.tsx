import { useState, useRef, useEffect } from "react";
import { useAppStore, Bill } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Printer, Receipt, Calendar, User, Trash2, RotateCcw, Edit, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { QRScannerModal } from "@/components/QRScannerModal";
import { decryptAES256, generateBillCancellationQRCode } from "@/lib/cryptoUtils";
import { useToast } from "@/hooks/use-toast";

const BillHistory = () => {
  const { bills, cancelBill, reinstateBill, hasPermission, refreshFromServer } = useAppStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [confirmReinstateId, setConfirmReinstateId] = useState<string | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Refresh data from server on mount
  useEffect(() => {
    refreshFromServer().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: log bills count when it changes
  useEffect(() => {
    console.log('[BillHistory] bills count:', bills?.length || 0);
    console.log('[BillHistory] bills:', bills);
    if (bills && bills.length > 0) {
      console.log('[BillHistory] first bill:', bills[0]);
    }
  }, [bills]);

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

  const handlePrint = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedBill) return;

    try {
      const storeName = selectedBill.storeName || settings.storeName;
      const storeAddress = selectedBill.storeAddress || settings.storeAddress;
      const storePhone = selectedBill.storePhone || settings.storePhone;
      const gstNumber = selectedBill.gstNumber || settings.gstNumber;

      const gstBlock = selectedBill.gstPercentage > 0 ? `
        <div class="divider"></div>
        <div class="row"><span>Taxable Value</span><span>${currency}${selectedBill.taxableAmount.toFixed(2)}</span></div>
        <div class="row"><span>GST (${selectedBill.gstPercentage}%)</span><span>${currency}${selectedBill.totalGst.toFixed(2)}</span></div>
      ` : '';

      const customerRow = selectedBill.customerName && selectedBill.customerName !== 'Walk-in'
        ? `<div class="row"><span>Customer:</span><span>${selectedBill.customerName}</span></div>`
        : "";

      // Generate AES-256 encrypted QR code for this bill
      let qrCodeData = '';
      try {
        qrCodeData = await generateBillCancellationQRCode(selectedBill.id, selectedBill.billNumber);
      } catch (qrErr: any) {
        console.error('QR generation error:', qrErr);
        // Fallback: show plain text QR
        qrCodeData = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110"><rect fill="white" width="110" height="110"/><text x="55" y="50" text-anchor="middle" font-size="10" font-family="monospace">Bill #${selectedBill.billNumber}</text><text x="55" y="70" text-anchor="middle" font-size="8" font-family="monospace">${selectedBill.id.substring(0, 8)}</text></svg>`)}`;
      }

      const printWindow = window.open("", "_blank", "width=400,height=700");
      if (!printWindow) {
        toast({ title: "Print blocked", description: "Allow popups to print bills", variant: "destructive" });
        return;
      }

      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>Bill #${selectedBill.billNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; color: #000; background: #fff; max-width: 350px; margin: auto; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 10px 0; }
              .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
              .items th, .items td { text-align: left; padding: 4px 0; }
              .items th:last-child, .items td:last-child { text-align: right; }
              .items { width: 100%; border-collapse: collapse; margin-top: 5px; }
              h2 { font-size: 18px; }
              .small { font-size: 12px; }
              .qr-wrap { text-align: center; margin: 12px 0 4px; }
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
            <div class="row"><span>Bill #:</span><span class="bold">${selectedBill.billNumber}</span></div>
            <div class="row"><span>Date:</span><span>${format(new Date(selectedBill.createdAt), "dd/MM/yyyy hh:mm a")}</span></div>
            <div class="row"><span>Cashier:</span><span>${selectedBill.createdByName}</span></div>
            ${customerRow}
            <div class="divider"></div>
            <table class="items">
              <thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead>
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
            <div class="row bold" style="font-size:1.1em"><span>TOTAL</span><span>${currency}${selectedBill.total.toLocaleString()}</span></div>
            <div class="divider"></div>
            <p class="center small" style="margin-bottom:4px">Payment(s):</p>
            ${selectedBill.payments.map(p => `
              <div class="row small"><span>${p.method.toUpperCase()}</span><span>${currency}${p.amount.toLocaleString()}</span></div>
            `).join('')}
            <div class="divider"></div>
            <div class="qr-wrap">
              <img src="${qrCodeData}" alt="Cancel QR" width="110" height="110"/>
              <p class="small center" style="margin-top:4px;font-size:10px;">Scan to cancel this bill</p>
            </div>
            <p class="center small bold" style="margin-top:8px">THANK YOU FOR VISITING!</p>
            ${selectedBill.isCancelled ? `<p class="center bold" style="margin-top:10px;color:red">*** CANCELLED ***</p>` : ''}
            <script>window.onload = () => { window.print(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      console.error('Print error:', err);
      toast({ title: "Print Error", description: err.message ?? "Failed to generate receipt", variant: "destructive" });
    }
  };

  // Cancel Bill button → immediately open QR scanner
  const handleCancelBillClick = (bill: Bill) => {
    setCancellingBill(bill);
    setQrScannerOpen(true);
  };

  const handleQRScanResult = async (scannedText: string) => {
    try {
      console.log('Scanned QR:', scannedText.substring(0, 50) + '...');

      // Check if this is a plain bill ID (manual entry fallback)
      // If decryption fails and input looks like a bill ID, use admin override
      if (!scannedText.startsWith('aes256:')) {
        // Manual entry - just a bill ID or number
        const billId = cancellingBill?.id;
        if (billId) {
          // Confirm with user before admin cancel
          const confirmed = window.confirm(
            `Cancel bill #${cancellingBill?.billNumber} using admin override?\n\nThis will restore stock but skip QR verification.`
          );
          if (confirmed) {
            setIsProcessing(true);
            await cancelBill(billId);
            setIsProcessing(false);
            setQrScannerOpen(false);
            setCancellingBill(null);
            setSelectedBill(null);
            toast({
              title: "Bill Cancelled",
              description: `Bill #${cancellingBill?.billNumber} has been cancelled (admin override).`
            });
          }
        }
        return;
      }

      // Try to decrypt the AES-256 encrypted payload
      const decrypted = await decryptAES256(scannedText);
      const payload = JSON.parse(decrypted);

      console.log('Decrypted payload:', payload);

      if (payload.action === 'CANCEL_BILL' && payload.billId) {
        // Verify the scanned bill matches the one we're trying to cancel
        if (cancellingBill?.id === payload.billId) {
          setIsProcessing(true);
          await cancelBill(payload.billId);
          setIsProcessing(false);
          setQrScannerOpen(false);
          setCancellingBill(null);
          setSelectedBill(null);
          toast({
            title: "Bill Cancelled",
            description: `Bill #${payload.billNumber} has been cancelled and stock restored.`
          });
        } else {
          toast({
            title: "Wrong Bill",
            description: "The scanned QR code is for a different bill.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Invalid QR Code",
          description: "This QR code is not a valid bill cancellation code.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error('QR decryption error:', err);
      // If decryption fails, offer admin override
      const useOverride = window.confirm(
        'QR code could not be decrypted. Use admin override to cancel this bill anyway?'
      );
      if (useOverride && cancellingBill?.id) {
        setIsProcessing(true);
        await cancelBill(cancellingBill.id);
        setIsProcessing(false);
        setQrScannerOpen(false);
        setCancellingBill(null);
        setSelectedBill(null);
        toast({
          title: "Bill Cancelled",
          description: `Bill #${cancellingBill?.billNumber} has been cancelled (admin override).`
        });
      } else {
        toast({
          title: "Scan Error",
          description: "Could not decrypt QR code. Make sure you're scanning the correct bill.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Bill History</h1>
          <p className="text-sm text-muted-foreground">{bills?.length || 0} total bills</p>
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
              onClick={(e) => {
                e.stopPropagation();
                console.log('Selected bill:', bill);
                setSelectedBill(bill);
              }}
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
                      onClick={(e) => { e.stopPropagation(); navigate('/pos', { state: { billToEdit: bill } }); }}
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
      <Dialog open={!!selectedBill} onOpenChange={(open) => { if (!open) setSelectedBill(null); }}>
        <DialogContent className="max-w-2xl glass-strong border-border max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>Bill #{selectedBill?.billNumber || 'Loading...'}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </Button>

                {selectedBill && !selectedBill.isCancelled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => { navigate('/pos', { state: { billToEdit: selectedBill } }); setSelectedBill(null); }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}

                {selectedBill && !selectedBill.isCancelled && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => handleCancelBillClick(selectedBill)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cancel Bill</span>
                  </Button>
                )}

{selectedBill?.isCancelled && (
                  hasPermission('bills.reinstate') ? (
                    confirmReinstateId === selectedBill.id ? (
                      <div className="flex items-center gap-1 bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1">
                        <span className="text-xs text-green-400 mr-1">Reinstate?</span>
                        <Button size="sm" className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700"
                          onClick={async () => {
                            setIsProcessing(true);
                            await reinstateBill(selectedBill.id);
                            setIsProcessing(false);
                            setConfirmReinstateId(null);
                            setSelectedBill(null);
                            toast({ title: "Bill Reinstated" });
                          }}>
                          Yes
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setConfirmReinstateId(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" className="h-8 gap-1.5 bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/40" variant="outline"
                        onClick={() => setConfirmReinstateId(selectedBill.id)}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reinstate</span>
                      </Button>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Admin access required to reinstate</p>
                  )
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedBill ? (
            <div className="space-y-4 text-sm">
              <div className="text-center border-b border-white/5 pb-3 space-y-0.5">
                <p className="font-bold">{selectedBill.storeName || 'Store'}</p>
                {selectedBill.storeAddress && <p className="text-xs text-muted-foreground">{selectedBill.storeAddress}</p>}
                {selectedBill.storePhone && <p className="text-xs text-muted-foreground">Ph: {selectedBill.storePhone}</p>}
                {selectedBill.gstNumber && <p className="text-xs font-mono text-primary">GSTIN: {selectedBill.gstNumber}</p>}
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>{format(new Date(selectedBill.createdAt), "dd MMM yyyy, hh:mm a")}</span>
                <span>by {selectedBill.createdByName || 'Unknown'}</span>
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
                    {(selectedBill.items || []).map((item, i) => (
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
                    <span>Taxable Value</span><span>{currency}{selectedBill.taxableAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST ({selectedBill.gstPercentage}%)</span><span>{currency}{selectedBill.totalGst.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between font-bold text-base border-t border-white/5 pt-2">
                <span>Total</span>
                <span>{currency}{selectedBill.total.toLocaleString()}</span>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Payments</p>
                {(selectedBill.payments || []).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="capitalize">{p.method}</span>
                    <span>{currency}{p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p>Loading bill details...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Scanner — opens directly when Cancel Bill is clicked */}
      <QRScannerModal
        isOpen={qrScannerOpen}
        onOpenChange={(open) => { setQrScannerOpen(open); if (!open) setCancellingBill(null); }}
        onScanSuccess={handleQRScanResult}
        cancellingBillNumber={cancellingBill?.billNumber}
      />
    </div>
  );
};

export default BillHistory;
