import { useState, useMemo, useEffect } from "react";
import { useAppStore, Customer, Bill, Product, Batch } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { encryptAES256, generateQRCode } from "@/lib/cryptoUtils"; 
import { Search, Plus, Minus, ShoppingCart, X, PackageCheck, Banknote, Smartphone, CreditCard, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const POS = () => {
  const { products, addBill, customers, addCustomer, currentUser } = useAppStore();
  const { settings } = useSettingsStore();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [cartSnapshot, setCartSnapshot] = useState<any[]>([]);
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerDialog, setNewCustomerDialog] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');

  const currency = settings.currency || "₹";
  const isNormalBill = (settings.defaultBillType || "GST") === "Normal";
  const currentGstRate = isNormalBill ? 0 : Number(settings.gstPercentage || 0);

  const getSortedBatches = (batches: Batch[] = []) => {
    return [...batches].sort((a, b) => {
      const dateA = a.expiryDate || (a as any).expiry || 'N/A';
      const dateB = b.expiryDate || (b as any).expiry || 'N/A';
      if (dateA === 'N/A') return 1;
      if (dateB === 'N/A') return -1;
      return dateA.localeCompare(dateB);
    });
  };

  useEffect(() => {
    const generateCancellationQR = async () => {
      if (lastBill?.id) {
        try {
          const payload = `CANCEL_BILL:${lastBill.id}:${lastBill.billNumber}`;
          const encryptedData = await encryptAES256(payload);
          const qrDataUrl = await generateQRCode(encryptedData);
          setQrCodeUrl(qrDataUrl);
        } catch (err) {
          console.error("QR Error:", err);
        }
      }
    };
    generateCancellationQR();
  }, [lastBill]);

  const getProductStock = (product: any) => {
    return (product.batches ?? []).reduce((sum: number, b: any) => sum + (Number(b.quantity) || 0), 0);
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const filteredProducts = useMemo(() => 
    products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku.toLowerCase().includes(search.toLowerCase())
    )
  , [products, search]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return [];
    return (customers || []).filter(c => 
      (c.name && c.name.toLowerCase().includes(term)) || 
      (c.phone && c.phone.includes(term))
    );
  }, [customers, customerSearch]);

  const addToCart = (product: any) => {
    const totalAvailable = getProductStock(product);
    const existing = cart.find(item => item.productId === product.id);
    const sortedBatches = getSortedBatches(product.batches || []);
    const activeBatch = sortedBatches.find((b: any) => Number(b.quantity) > 0) || sortedBatches[0];
    
    if (totalAvailable <= 0) {
      toast({ variant: "destructive", title: "Out of Stock" });
      return;
    }

    if (existing) {
      if (existing.quantity >= totalAvailable) {
        toast({ variant: "destructive", title: "Limit Reached" });
        return;
      }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { 
        productId: product.id, 
        name: product.name, 
        price: Number(product.price), 
        quantity: 1, 
        unit: product.unit,
        batchNo: activeBatch?.batchNo || "N/A",
        expiryDate: activeBatch?.expiryDate || (activeBatch as any)?.expiry || "N/A", 
        batches: sortedBatches,
        taxRate: currentGstRate 
      }]);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const billData = {
        customerName: selectedCustomer?.name || "Walking Customer",
        customerPhone: selectedCustomer?.phone || "",
        totalAmount: Number(cartSubtotal), 
        paymentMethod: selectedPaymentMethod,
        storeName: settings.storeName || "Omni Inventory Pro",
        storeAddress: settings.storeAddress || "",
        storePhone: settings.storePhone || "",
        gstNumber: isNormalBill ? "" : (settings.gstNumber || ""),
        gstPercentage: currentGstRate,
        billType: isNormalBill ? "Normal" : (settings.defaultBillType || "GST"),
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          batchNo: item.batchNo || "N/A",
          expiryDate: item.expiryDate || "N/A",
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: Number(item.price) * Number(item.quantity)
        })),
        date: new Date().toISOString()
      };

      const result = await addBill(billData) as Bill; 
      setCartSnapshot([...cart]);
      setLastBill(result);
      setShowPrintModal(true);
      toast({ title: "Success", description: "Transaction completed!" });
    } catch (error) {
      console.error("Checkout failed", error);
      toast({ title: "Checkout Error", variant: "destructive" });
    }
  };

  const finalizeTransaction = () => {
    setShowPrintModal(false);
    setCart([]);
    setSelectedCustomer(null);
    setShowWithdrawalModal(true);
  };

  const triggerPrint = () => {
    if (!lastBill) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isNormal = lastBill.billType === 'Normal';
    const billGst = Number(lastBill.gstPercentage || 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Bill#${lastBill.billNumber}</title>
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
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { border-bottom: 1.5px solid black; text-align: left; font-size: 14px; padding: 10px 0; }
            td { font-size: 14px; padding: 12px 0; vertical-align: top; }
            .row { display: flex; justify-content: space-between; font-size: 14px; margin-top: 8px; }
            .grand-total { 
              font-size: 20px; 
              border-top: 2.5px solid black; 
              padding-top: 12px; 
              margin-top: 12px; 
            }
            @page { margin: 0; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="bold" style="font-size: 22px; margin-bottom: 6px;">${settings.storeName}</div>
            <div style="font-size: 13px;">${settings.storeAddress}</div>
            <div style="font-size: 13px;">Ph: ${settings.storePhone}</div>
            ${!isNormal && settings.gstNumber ? `<div style="font-size: 13px; font-weight: bold; margin-top: 6px;">GSTIN: ${settings.gstNumber}</div>` : ''}
          </div>

          <div class="divider"></div>

          <div style="font-size: 13px;">
            <div>INVOICE: ${lastBill.billNumber}</div>
            <div>DATE   : ${format(new Date(lastBill.createdAt), "dd/MM/yyyy HH:mm")}</div>
            <div class="bold">CUST   : ${lastBill.customerName}</div>
            <div>CASHIER: ${currentUser?.fullName || currentUser?.username || 'Staff'}</div>
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th>ITEM</th>
                <th style="text-align:center">QTY</th>
                <th style="text-align:right">PRICE</th>
              </tr>
            </thead>
            <tbody>
              ${lastBill.items.map((item: any) => {
                const itemDisplayPrice = isNormal ? item.price : (item.price / (1 + (billGst / 100)));
                return `
                <tr>
                  <td style="text-transform:uppercase; font-weight: bold;">${item.name}</td>
                  <td style="text-align:center">${item.quantity}</td>
                  <td style="text-align:right">${currency}${(itemDisplayPrice * item.quantity).toFixed(2)}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          <div class="divider"></div>
          
          ${!isNormal ? `
            <div class="row">
              <span>Subtotal (Ex-Tax):</span>
              <span>${currency}${lastBill.taxableAmount?.toFixed(2)}</span>
            </div>
            <div class="row">
              <span>GST (${billGst}%):</span>
              <span>${currency}${lastBill.totalGst?.toFixed(2)}</span>
            </div>
          ` : `
            <div class="row">
              <span>Total:</span>
              <span>${currency}${Math.round(lastBill.total)}.00</span>
            </div>
          `}

          <div class="row bold grand-total">
            <span>NET PAYABLE:</span>
            <span>${currency}${Math.round(lastBill.total)}.00</span>
          </div>

          <div class="text-center" style="margin-top: 40px;">
            ${qrCodeUrl ? `<img src="${qrCodeUrl}" style="width:110px; height:110px;">` : ''}
            <div style="font-size: 12px; margin-top: 15px; font-weight: bold;">*** THANK YOU - VISIT AGAIN ***</div>
          </div>

          <script>
            window.onload = () => { 
              window.print(); 
              setTimeout(() => window.close(), 500); 
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => finalizeTransaction(), 1000);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    try {
      const created = await addCustomer(newCustomer) as any; 
      setSelectedCustomer(created);
      setNewCustomer({ name: "", phone: "" });
      setNewCustomerDialog(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] p-4">
      
      <div className="flex-1 flex flex-col gap-4 overflow-hidden print:hidden">
        <GlassCard className="p-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              placeholder="Search products..." 
              className="w-full bg-transparent border-b border-white/10 pl-10 h-12 outline-none focus:border-primary transition-colors" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar">
          {filteredProducts.map(product => {
            const stock = getProductStock(product);
            return (
              <GlassCard 
                key={product.id} 
                className={`p-3 flex flex-col justify-between cursor-pointer hover:border-primary/50 ${stock <= 0 ? 'opacity-40' : ''}`}
                onClick={() => stock > 0 && addToCart(product)}
              >
                <div>
                  <p className="font-bold text-sm line-clamp-2 uppercase">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{product.sku}</p>
                </div>
                <div className="mt-4 flex justify-between items-end">
                  <p className="font-bold text-primary">{currency}{product.price}</p>
                  <span className={`text-[10px] px-1.5 rounded font-bold ${stock < 10 ? 'bg-orange-500/20 text-orange-500' : 'bg-primary/10'}`}>
                    Qty: {stock}
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      <GlassCard className="w-full lg:w-96 flex flex-col shrink-0 print:hidden">
        <div className="p-4 border-b border-white/10 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Current Cart</h2>
          <div className="relative">
            {selectedCustomer ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex justify-between items-center">
                <div className="truncate">
                  <p className="font-bold text-sm">{selectedCustomer.name}</p>
                  <p className="text-[10px] opacity-70">{selectedCustomer.phone}</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)}><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <Input placeholder="Search Customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            )}
            {customerSearch.trim() !== "" && !selectedCustomer && (
              <div className="absolute top-full left-0 right-0 z-[100] bg-zinc-900 border border-white/10 mt-1 rounded-lg shadow-2xl">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="w-full text-left px-4 py-2 hover:bg-white/5 border-b border-white/5 text-sm">
                    {c.name} ({c.phone})
                  </button>
                ))}
                <button onClick={() => { setNewCustomer({ name: customerSearch, phone: "" }); setNewCustomerDialog(true); }} className="w-full text-left px-4 py-3 text-xs text-primary font-bold">
                  + Add New Customer
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {cart.map(item => (
            <div key={item.productId} className="flex items-center justify-between">
              <div className="flex-1 truncate pr-2">
                <p className="text-sm font-medium truncate uppercase">{item.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Batch: {item.batchNo}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setCart(cart.map(i => i.productId === item.productId ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0))}><Minus className="w-3 h-3"/></Button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => addToCart(products.find(p => p.id === item.productId))}><Plus className="w-3 h-3"/></Button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white/5 border-t border-white/10 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button variant={selectedPaymentMethod === 'cash' ? 'default' : 'outline'} className="flex flex-col h-14" onClick={() => setSelectedPaymentMethod('cash')}><Banknote className="w-4 h-4" /><span className="text-[10px]">CASH</span></Button>
            <Button variant={selectedPaymentMethod === 'upi' ? 'default' : 'outline'} className="flex flex-col h-14" onClick={() => setSelectedPaymentMethod('upi')}><Smartphone className="w-4 h-4" /><span className="text-[10px]">UPI</span></Button>
            <Button variant={selectedPaymentMethod === 'card' ? 'default' : 'outline'} className="flex flex-col h-14" onClick={() => setSelectedPaymentMethod('card')}><CreditCard className="w-4 h-4" /><span className="text-[10px]">CARD</span></Button>
          </div>
          <Button className="w-full h-14 font-bold text-lg" disabled={cart.length === 0} onClick={handleCheckout}>
            Pay {currency}{cartSubtotal.toFixed(2)}
          </Button>
        </div>
      </GlassCard>

      <Dialog open={showPrintModal} onOpenChange={(open) => { if(!open) finalizeTransaction(); }}>
        <DialogContent className="max-w-[420px] bg-zinc-950 border-white/20 p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Invoice Generated</DialogTitle>
            <DialogDescription>Bill preview and print options</DialogDescription>
          </DialogHeader>

          <div className="p-8 bg-zinc-900 overflow-y-auto max-h-[80vh]">
            <div className="w-full text-[14px] leading-relaxed bg-white text-black p-8 font-mono shadow-xl">
              
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold uppercase tracking-tight">{settings.storeName}</h2>
                <p className="text-[12px] mt-1">{settings.storeAddress}</p>
                <p className="text-[12px]">Ph: {settings.storePhone}</p>
                {lastBill?.billType !== 'Normal' && settings.gstNumber && (
                  <p className="text-[12px] font-bold mt-1">GSTIN: {settings.gstNumber}</p>
                )}
              </div>

              <div className="text-center border-b-2 border-black border-double pb-2 mb-4">
                <p className="font-bold text-lg">INVOICE: {lastBill?.billNumber}</p>
              </div>

              <div className="mb-4 text-[12px] uppercase space-y-1">
                <div className="flex justify-between"><span>DATE:</span><span className="font-bold">{lastBill && format(new Date(lastBill.createdAt), "dd/MM/yyyy HH:mm")}</span></div>
                <div className="flex justify-between"><span>CUST:</span><span className="font-bold uppercase">{lastBill?.customerName}</span></div>
                <div className="flex justify-between"><span>CASHIER:</span><span className="font-bold uppercase">{currentUser?.fullName || currentUser?.username || 'Staff'}</span></div>
              </div>

              <table className="w-full mb-6">
                <thead><tr className="border-b-2 border-black text-left font-bold text-[13px]"><th>ITEM</th><th className="text-center">QTY</th><th className="text-right">PRICE</th></tr></thead>
                <tbody>
                  {lastBill?.items.map((item: any, i: number) => {
                    const isNormal = lastBill.billType === 'Normal';
                    const billGst = Number(lastBill.gstPercentage || 0);
                    const previewPrice = isNormal ? item.price : (item.price / (1 + (billGst / 100)));
                    return (
                      <tr key={i} className="text-[13px] border-b border-gray-100">
                        <td className="py-3 pr-2 font-bold uppercase leading-tight">{item.name}</td>
                        <td className="py-3 text-center">{item.quantity}</td>
                        <td className="py-3 text-right font-bold">{currency}{(previewPrice * item.quantity).toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="space-y-1 border-t-2 border-black pt-4">
                {lastBill?.billType !== 'Normal' ? (
                  <>
                    <div className="flex justify-between"><span>Subtotal (Ex-Tax):</span><span>{currency}{lastBill?.taxableAmount?.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Total GST ({lastBill?.gstPercentage}%):</span><span>{currency}{lastBill?.totalGst?.toFixed(2)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between"><span>Total:</span><span>{currency}{Math.round(lastBill?.total || 0)}.00</span></div>
                )}
                <div className="flex justify-between font-bold text-xl border-t-2 border-black border-double pt-4 mt-4">
                  <span>NET PAYABLE:</span><span>{currency}{Math.round(lastBill?.total || 0)}.00</span>
                </div>
              </div>

            </div>
          </div>

          <div className="p-4 bg-zinc-900 flex gap-3 border-t border-white/10">
            <Button variant="outline" className="flex-1 h-12" onClick={finalizeTransaction}>Close</Button>
            <Button className="flex-1 h-12 gap-2 font-bold" onClick={triggerPrint}><Printer size={18}/> PRINT BILL</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWithdrawalModal} onOpenChange={setShowWithdrawalModal}>
        <DialogContent className="max-w-md bg-zinc-950 border-primary/30 p-8 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
              <PackageCheck className="w-6 h-6"/> Pull These Batches
            </DialogTitle>
            <DialogDescription className="sr-only">List of batches to pull from inventory</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar mt-4">
            {cartSnapshot.map((item: any, i: number) => (
              <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-primary/20 transition-all">
                <p className="font-bold text-base text-white uppercase">{item.name} (x{item.quantity})</p>
                <div className="grid grid-cols-2 mt-3 pt-3 border-t border-white/5 text-[11px] opacity-70 font-mono">
                  <p className="uppercase">BATCH: {item.batchNo || "N/A"}</p>
                  <p className="text-right uppercase">EXP: {item.expiryDate || "N/A"}</p>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full mt-8 h-14 text-lg font-bold shadow-lg shadow-primary/20" onClick={() => setShowWithdrawalModal(false)}>Confirm & Finish</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={newCustomerDialog} onOpenChange={setNewCustomerDialog}>
        <DialogContent className="glass-strong max-w-sm">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
            <DialogDescription className="sr-only">Add a new customer and select them for this bill</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Full Name" />
            <Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Phone Number" />
            <Button className="w-full h-12 font-bold" onClick={handleAddCustomer}>Save & Select</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default POS;