import { useState, useEffect } from "react";
import { useAppStore, Product, Batch } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { StatusBadge, getStockStatus } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Package, ChevronDown, ChevronUp, Check, X, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const emptyForm = {
  name: '', 
  sku: '', 
  barcode: '', 
  category: 'General', 
  price: 0, 
  costPrice: 0,
  lowStockThreshold: 10, 
  veryLowStockThreshold: 3, 
  unit: 'piece',
  batchNo: '', 
  mfgDate: '', 
  expiryDate: '', 
  quantity: 0,
  noExpiry: false
};

const Inventory = () => {
  const { 
    products: rawProducts, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    deleteBatch, 
    settings, 
    hasPermission, 
    refreshFromServer 
  } = useAppStore();

  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [skuOpen, setSkuOpen] = useState(false); 
  const [editId, setEditId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<{productId: string, batchId: string} | null>(null);
  const [form, setForm] = useState<any>(emptyForm); 
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const currencySymbol = settings?.currency || '₹';

  useEffect(() => {
    refreshFromServer();
  }, []);

  const isInvalidDate = form.mfgDate && form.expiryDate && !form.noExpiry && form.expiryDate < form.mfgDate;

  const getTotalStock = (batches: Batch[] = []) => 
    (batches ?? []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const parts = dateStr.split('-');
    return parts.length >= 2 ? `${parts[1]}/${parts[0]}` : dateStr;
  };

  const filtered = products.filter(p =>
    (p.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (p.sku?.toLowerCase() || "").includes(search.toLowerCase())
  );

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setEditingBatchId(null);
    setForm(emptyForm);
    setSkuOpen(false);
  };

  const handleSelectExistingProduct = (product: Product) => {
    setForm({
      ...emptyForm,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      category: product.category,
      price: product.price,
      costPrice: product.costPrice,
      unit: product.unit,
      lowStockThreshold: product.lowStockThreshold,
    });
    setSkuOpen(false);
  };

  const handleSave = async () => {
    if (!form.sku.trim()) {
      toast({ title: "Error", description: "SKU is required", variant: "destructive" });
      return;
    }

    if (isInvalidDate) {
      toast({ title: "Invalid Date", description: "Expiry date cannot be before manufacturing date.", variant: "destructive" });
      return;
    }

    try {
      const finalExpiry = form.noExpiry ? "N/A" : (form.expiryDate || "");
      
      // CRITICAL: Ensure all numeric fields are actual Numbers
      const payload = {
        name: form.name || "Unnamed Product",
        sku: form.sku.toUpperCase(),
        barcode: form.barcode || form.sku.toUpperCase(),
        category: form.category || "General",
        price: Number(form.price) || 0,
        costPrice: Number(form.costPrice) || 0,
        unit: form.unit || "piece",
        lowStockThreshold: Number(form.lowStockThreshold) || 10,
        veryLowStockThreshold: Number(form.veryLowStockThreshold) || 3,
      };

      const newBatch: Batch = {
        id: editingBatchId || Math.random().toString(36).substring(2, 11),
        batchNo: form.batchNo || "DEFAULT",
        mfgDate: form.mfgDate || "",
        expiryDate: finalExpiry,
        quantity: Number(form.quantity) || 0 // Explicit number conversion
      };

      if (editId) {
        const currentProduct = products.find(p => p.id === editId);
        if (!currentProduct) return;

        let updatedBatches = [...(currentProduct.batches || [])];

        if (editingBatchId) {
          updatedBatches = updatedBatches.map(b => b.id === editingBatchId ? newBatch : b);
        }

        await updateProduct(editId, { ...payload, batches: updatedBatches } as any);
        toast({ title: "Updated Successfully" });
      } else {
        const existingProduct = products.find(p => p.sku === form.sku.toUpperCase());

        if (existingProduct) {
          await updateProduct(existingProduct.id, {
            ...existingProduct,
            batches: [...(existingProduct.batches ?? []), newBatch]
          });
          toast({ title: "New Batch Added" });
        } else {
          await addProduct({ ...payload, batches: [newBatch] } as any);
          toast({ title: "Product Created" });
        }
      }

      closeDialog();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to register product", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gradient">Inventory</h1>
        {hasPermission('inventory.add') && (
          <Button onClick={() => { setEditId(null); setForm(emptyForm); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        )}
      </div>

      <GlassCard className="p-4 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search SKU or Name..." className="pl-10 bg-accent/10 border-none" value={search} onChange={e => setSearch(e.target.value)} />
      </GlassCard>

      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">No products found.</p>}
        {filtered.map(p => {
          const totalQty = getTotalStock(p.batches);
          const isExpanded = expandedId === p.id;
          const isConfirmingDelete = deleteConfirmId === p.id;

          return (
            <GlassCard key={p.id} className="p-0 overflow-hidden border-white/5">
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                <div className="flex items-center gap-4 flex-1">
                  <Package className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold text-sm">{p.name || "Unnamed Product"}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase">{p.sku}</p>
                  </div>
                  <StatusBadge status={getStockStatus(totalQty, p.lowStockThreshold, p.veryLowStockThreshold)} />
                </div>

                <div className="flex items-center gap-2">
                  <div className="mr-4 text-right">
                    <p className="text-[10px] uppercase text-muted-foreground">Total Stock</p>
                    <p className="text-sm font-bold font-mono">{totalQty} {p.unit}</p>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 bg-red-500/10 p-1 rounded-md animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => { deleteProduct(p.id); setDeleteConfirmId(null); }}>Confirm</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeleteConfirmId(null)}><X className="w-3 h-3"/></Button>
                    </div>
                  ) : (
                    <>
                      {hasPermission('inventory.edit') && (
                        <Button variant="ghost" size="icon" onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditId(p.id); 
                          setForm({...p, batchNo: '', quantity: 0, mfgDate: '', expiryDate: '', noExpiry: false} as any); 
                          setDialogOpen(true); 
                        }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {hasPermission('inventory.delete') && (
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-4 bg-black/40 border-t border-white/5">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="h-8 text-[10px]">Batch No</TableHead>
                        <TableHead className="h-8 text-[10px]">Mfg/Exp</TableHead>
                        <TableHead className="h-8 text-[10px] text-right">Qty</TableHead>
                        {hasPermission('inventory.edit') && <TableHead className="h-8 text-[10px] text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.batches?.map(b => (
                        <TableRow key={b.id} className="border-white/5 hover:bg-white/5">
                          <TableCell className="py-2 text-xs font-mono text-primary">{b.batchNo}</TableCell>
                          <TableCell className="py-2 text-xs">{formatDate(b.mfgDate)} - {formatDate(b.expiryDate)}</TableCell>
                          <TableCell className="py-2 text-right font-bold text-xs">{b.quantity}</TableCell>
                          
                          <TableCell className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              {hasPermission('inventory.edit') && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                  setEditId(p.id);
                                  setEditingBatchId(b.id);
                                  setForm({ ...p, batchNo: b.batchNo, quantity: b.quantity, mfgDate: b.mfgDate, expiryDate: b.expiryDate, noExpiry: b.expiryDate === 'N/A' } as any);
                                  setDialogOpen(true);
                                }}>
                                  <Edit className="w-3 h-3" />
                                </Button>
                              )}

                              {hasPermission('inventory.delete_batch') && (
                                confirmDeleteBatch?.productId === p.id && confirmDeleteBatch?.batchId === b.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button variant="destructive" size="icon" className="h-5 w-5" onClick={() => { deleteBatch(p.id, b.id); setConfirmDeleteBatch(null); }}>
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setConfirmDeleteBatch(null)}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setConfirmDeleteBatch({ productId: p.id, batchId: b.id })}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="glass-strong border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBatchId ? `Edit Batch: ${form.batchNo}` : editId ? 'Edit Product Info' : 'Add New Inventory'}</DialogTitle>
            <DialogDescription>
              {editingBatchId ? "Update specific batch numbers and quantities." : "Manage product catalog and initial stock levels."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-y-6 py-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">SKU / Barcode</Label>
                <Popover open={skuOpen && !editId} onOpenChange={setSkuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={skuOpen}
                      disabled={!!editId}
                      className={cn(
                        "w-full justify-between bg-accent/20 border-white/10 font-normal h-10 text-xs",
                        !form.sku && "text-muted-foreground"
                      )}
                    >
                      {form.sku || "Select or type SKU..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 glass-strong border-white/10">
                    <Command>
                      <CommandInput 
                        placeholder="Search SKU..." 
                        onValueChange={(val) => setForm((f: any) => ({ ...f, sku: val.toUpperCase() }))}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <p className="text-xs p-2">New SKU: <span className="text-primary font-bold">{form.sku}</span></p>
                        </CommandEmpty>
                        <CommandGroup heading="Existing Products">
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.sku}
                              onSelect={() => handleSelectExistingProduct(product)}
                              className="text-xs cursor-pointer"
                            >
                              <Check className={cn("mr-2 h-3 w-3", form.sku === product.sku ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-bold">{product.sku}</span>
                                <span className="text-[10px] opacity-60">{product.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="col-span-6 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Product Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-accent/20 border-white/10 h-10" />
              </div>
            </div>

            {(!editId || editingBatchId) && (
              <div className="grid grid-cols-4 gap-4 py-2 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Batch No</Label>
                  <Input value={form.batchNo} onChange={e => setForm({...form, batchNo: e.target.value.toUpperCase()})} className="bg-accent/20 border-white/10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="bg-accent/20 border-white/10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Mfg Date</Label>
                  <Input 
                    type="month" 
                    max="9999-12"
                    value={form.mfgDate} 
                    onChange={e => setForm({...form, mfgDate: e.target.value})} 
                    className="bg-accent/20 border-white/10 h-10 w-full [color-scheme:dark]" 
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Exp Date</Label>
                    <div className="flex items-center space-x-1.5">
                      <Checkbox 
                        id="no-expiry" 
                        checked={form.noExpiry} 
                        onCheckedChange={(checked) => setForm({...form, noExpiry: checked === true})} 
                      />
                      <label htmlFor="no-expiry" className="text-[9px] font-bold uppercase cursor-pointer text-primary">No Exp</label>
                    </div>
                  </div>
                  <Input 
                    type="month" 
                    max="9999-12"
                    disabled={form.noExpiry} 
                    value={form.noExpiry ? "" : form.expiryDate} 
                    onChange={e => setForm({...form, expiryDate: e.target.value})} 
                    className={cn(
                      "bg-accent/20 border-white/10 transition-all h-10 w-full [color-scheme:dark]", 
                      form.noExpiry && "opacity-20 grayscale",
                      isInvalidDate && "border-red-500 ring-1 ring-red-500 bg-red-500/10"
                    )} 
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Price ({currencySymbol})</Label>
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="bg-accent/20 border-white/10 font-bold text-primary h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cost Price ({currencySymbol})</Label>
                <Input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} className="bg-accent/20 border-white/10 h-10" />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} className="px-10">{editingBatchId ? 'Update Batch' : editId ? 'Save Product' : 'Register Product'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;