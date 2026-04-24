import { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore, BillItem, Payment, Customer, Bill } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { useLocation } from "react-router-dom";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  User, 
  PackageX,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POS = () => {
  // Destructure updateBill and bills from the store
  const { products, createBill, updateBill, bills, customers, addCustomer } = useAppStore();
  const { settings } = useSettingsStore();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<BillItem[]>([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([{ method: 'cash', amount: 0 }]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerDialog, setNewCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  const { toast } = useToast();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.billToEdit) {
      const editData = location.state.billToEdit;
      setBillToEdit(editData);

      setCart(editData.items.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        batchNo: item.batchNo
      })));

      if (editData.customerId) {
        setSelectedCustomer({
          id: editData.customerId,
          name: editData.customerName || 'Walk-in',
          phone: editData.customerPhone || '' 
        } as Customer);
      }

      setPayments(editData.payments);
    }
  }, [location.state?.billToEdit]);

  const currency = settings?.currency || '₹';
  const gstRate = Number(settings?.gstPercentage) || 0;

  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const taxableAmount = gstRate > 0 ? cartSubtotal / (1 + gstRate / 100) : cartSubtotal;
  const totalGst = cartSubtotal - taxableAmount;
  const paymentTotal = payments.reduce((s, p) => s + p.amount, 0);

  const filteredProducts = products.filter((p: any) => 
    (p.batches?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0) > 0 && (
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const printReceipt = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const gstBlock = bill.gstPercentage > 0 ? `
      <div class="divider"></div>
      <div class="row"><span>Taxable Value</span><span>${currency}${bill.taxableAmount.toFixed(2)}</span></div>
      <div class="row"><span>GST (${bill.gstPercentage}%)</span><span>${currency}${bill.totalGst.toFixed(2)}</span></div>
    ` : '';

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt #${bill.billNumber}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; font-size: 13px; color: #000; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .header { font-size: 16px; margin-bottom: 4px; }
            .footer { margin-top: 15px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header bold">${bill.storeName}</div>
            ${bill.storeAddress ? `<div>${bill.storeAddress}</div>` : ''}
            ${bill.storePhone ? `<div>Ph: ${bill.storePhone}</div>` : ''}
            ${bill.gstNumber ? `<div class="bold" style="margin-top:4px">GSTIN: ${bill.gstNumber}</div>` : ''}
          </div>
          <div class="divider"></div>
          <div class="row"><span>Bill No:</span><span class="bold">${bill.billNumber}</span></div>
          <div class="row"><span>Date:</span><span>${new Date(bill.createdAt).toLocaleString('en-IN')}</span></div>
          <div class="row"><span>Customer:</span><span>${bill.customerName || 'Walk-in'}</span></div>
          <div class="divider"></div>
          <div class="row bold"><span style="flex: 2">Item</span><span style="flex: 1; text-align: center">Qty</span><span style="flex: 1; text-align: right">Price</span></div>
          ${bill.items.map((item: any) => `
            <div class="row">
              <span style="flex: 2">${item.name}</span>
              <span style="flex: 1; text-align: center">${item.quantity}</span>
              <span style="flex: 1; text-align: right">${currency}${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          ${gstBlock}
          <div class="divider"></div>
          <div class="row bold" style="font-size: 1.3em; margin-top: 5px;"><span>NET TOTAL</span><span>${currency}${bill.total.toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="text-center footer"><p class="bold">THANK YOU FOR VISITING!</p></div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const addToCart = (product: any) => {
    const totalAvailable = product.batches?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= totalAvailable) {
          toast({ title: "Insufficient stock", variant: "destructive" });
          return prev;
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    setSearch("");
    searchInputRef.current?.focus();
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      const product = products.find(p => p.id === productId);
      const totalAvailable = product?.batches?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
      if (newQty > totalAvailable) {
        toast({ title: "Stock limit reached", variant: "destructive" });
        return i;
      }
      return { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCompleteBill = () => {
    if (paymentTotal < cartSubtotal) {
      toast({ title: "Insufficient payment", variant: "destructive" });
      return;
    }

    const billSettings = {
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      gstNumber: settings.gstNumber,
      gstPercentage: settings.gstPercentage,
      defaultBillType: settings.defaultBillType,
    };

    if (billToEdit) {
      // --- UPDATE EXISTING BILL ---
      updateBill(billToEdit.id, cart, payments, selectedCustomer || undefined, billSettings);
      
      // Get updated bill from store for printing
      const updated = useAppStore.getState().bills.find(b => b.id === billToEdit.id);
      if (updated) printReceipt(updated);
      
      toast({ title: "Bill Updated", description: `Bill #${billToEdit.billNumber} modified.` });
    } else {
      // --- CREATE NEW BILL ---
      const bill = createBill(cart, payments, selectedCustomer || undefined, billSettings);
      printReceipt(bill);
      toast({ title: "Transaction Completed", description: `Bill #${bill.billNumber} generated.` });
    }
    
    // Reset Everything
    setCart([]);
    setPayments([{ method: 'cash', amount: 0 }]);
    setSelectedCustomer(null);
    setBillToEdit(null);
    setPaymentDialog(false);

    // Clear URL state to prevent re-triggering edit on refresh
    window.history.replaceState({}, document.title);
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;
    addCustomer(newCustomer);
    setNewCustomer({ name: '', phone: '' });
    setNewCustomerDialog(false);
    toast({ title: "Customer Registered" });
  };

  const updatePayment = (index: number, data: Partial<Payment>) => {
    setPayments(prev => prev.map((p, i) => i === index ? { ...p, ...data } : p));
  };

  const paymentIcons = { cash: Banknote, upi: Smartphone, card: CreditCard };

  return (
    <div className="animate-fade-in h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-4">
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <GlassCard className="p-3 mb-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              ref={searchInputRef}
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-accent/20 h-12 text-lg"
              autoFocus
            />
          </div>
        </GlassCard>

        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="glass-subtle group border border-transparent hover:border-primary/40 rounded-xl p-4 text-left transition-all active:scale-95 flex flex-col justify-between h-32"
                >
                  <div>
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">{p.sku}</p>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-lg font-black">{currency}{p.price}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <PackageX className="w-12 h-12 mb-2" />
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col h-full">
        <GlassCard variant="strong" className="flex-1 flex flex-col p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2 uppercase tracking-tighter">
              <ShoppingCart className="w-5 h-5" /> {billToEdit ? `Editing Bill #${billToEdit.billNumber}` : 'Cart'}
            </h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">
              {cart.length} Items
            </span>
          </div>

          <div className="mb-4">
            {selectedCustomer ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-bold">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCustomer(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Find/Add Customer..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="bg-accent/10 h-10 text-xs"
                />
                {customerSearch && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-black/80 border border-white/20 mt-1 rounded-lg shadow-xl max-h-40 overflow-y-auto backdrop-blur">
                    {filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 border-b last:border-0">
                        {c.name} ({c.phone})
                      </button>
                    ))}
                    <button onClick={() => setNewCustomerDialog(true)} className="w-full text-left px-4 py-2 text-xs text-white font-bold">
                      + Add New Customer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
            {cart.map(item => (
              <div key={item.productId} className="flex flex-col p-2 rounded-lg bg-accent/10">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium truncate flex-1 pr-2">{item.name}</p>
                  <button onClick={() => removeFromCart(item.productId)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 bg-background/50 rounded p-0.5">
                    <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded"><Plus className="w-3 h-3" /></button>
                  </div>
                  <p className="text-sm font-black">{currency}{(item.price * item.quantity).toFixed(0)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed pt-4 space-y-2">
            <div className="flex justify-between items-end pt-2">
              <span className="font-bold">Payable</span>
              <span className="text-3xl font-black text-primary">{currency}{cartSubtotal.toFixed(0)}</span>
            </div>

            <Button 
              className="w-full h-14 mt-4 text-lg font-bold" 
              disabled={cart.length === 0}
              onClick={() => {
                setPayments([{ method: 'cash', amount: Number(cartSubtotal.toFixed(0)) }]);
                setPaymentDialog(true);
              }}
            >
              {billToEdit ? 'UPDATE BILL' : 'SETTLE & BILL'}
            </Button>
          </div>
        </GlassCard>
      </div>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="glass-strong border-border max-w-md">
          <DialogHeader><DialogTitle>{billToEdit ? 'Confirm Edit' : 'Payment Confirmation'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {payments.map((p, i) => {
              const Icon = paymentIcons[p.method as keyof typeof paymentIcons];
              return (
                <div key={i} className="flex gap-3 items-center">
                  <div className="bg-accent p-2 rounded-lg"><Icon className="w-5 h-5 text-primary" /></div>
                  <select 
                    className="bg-accent text-sm rounded-lg p-2 h-10 outline-none"
                    value={p.method}
                    onChange={e => updatePayment(i, { method: e.target.value as any })}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                  <Input 
                    type="number" 
                    className="flex-1 h-10" 
                    value={p.amount} 
                    onChange={e => updatePayment(i, { amount: +e.target.value })}
                  />
                </div>
              );
            })}
            
            <div className="bg-accent/30 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm"><span>Grand Total</span><span>{currency}{cartSubtotal.toFixed(0)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>Total Received</span><span>{currency}{paymentTotal.toFixed(0)}</span></div>
            </div>

            <Button className="w-full h-12 font-bold" disabled={paymentTotal < cartSubtotal} onClick={handleCompleteBill}>
              {billToEdit ? 'SAVE CHANGES' : 'GENERATE RECEIPT'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newCustomerDialog} onOpenChange={setNewCustomerDialog}>
        <DialogContent className="glass-strong max-w-sm">
          <DialogHeader><DialogTitle>New Customer Registration</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Mobile Number</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></div>
            <Button className="w-full" onClick={handleAddCustomer}>Save & Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;