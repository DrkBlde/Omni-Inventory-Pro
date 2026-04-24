import { useState } from "react";
import { useAppStore, Product, Batch } from "@/lib/store";
import { GlassCard } from "@/components/GlassCard";
import { StatusBadge, getStockStatus } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Package, ChevronDown, ChevronUp, Check, X, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const emptyForm = {
  name: '', sku: '', barcode: '', category: '', price: 0, costPrice: 0,
  lowStockThreshold: 10, veryLowStockThreshold: 3, unit: 'piece',
  batchNo: '', mfgDate: '', expiryDate: '', quantity: 0
};

const Inventory = () => {
  // Added hasPermission to the store destructuring
  const { products, addProduct, updateProduct, deleteProduct, settings, hasPermission } = useAppStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [skuOpen, setSkuOpen] = useState(false); 
  const [editId, setEditId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const currencySymbol = settings?.currency || '₹';

  const getTotalStock = (batches: Batch[] = []) => 
    (batches ?? []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const [y, m] = parts;
      return `${m}/${y}`;
    }
    return dateStr;
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
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
      barcode: product.barcode,
      category: product.category,
      price: product.price,
      costPrice: product.costPrice,
      unit: product.unit,
      lowStockThreshold: product.lowStockThreshold,
    });
    setSkuOpen(false);
    toast({ title: "Product Data Imported", description: `Loaded details for ${product.sku}` });
  };

  const handleSave = () => {
    if (!form.sku.trim()) {
      toast({ title: "Error", description: "SKU is required", variant: "destructive" });
      return;
    }

    const existingProduct = products.find(p => p.sku === form.sku);

    if (editId) {
      const currentProduct = products.find(p => p.id === editId);
      if (!currentProduct) return;

      let updatedBatches = [...(currentProduct.batches || [])];

      if (editingBatchId) {
        updatedBatches = updatedBatches.map(b => 
          b.id === editingBatchId 
            ? { ...b, batchNo: form.batchNo, quantity: form.quantity, mfgDate: form.mfgDate, expiryDate: form.expiryDate }
            : b
        );
      }

      updateProduct(editId, { ...form, batches: updatedBatches } as any);
      toast({ title: "Updated Successfully" });
    } else if (existingProduct) {
      const newBatch: Batch = {
        id: Math.random().toString(36).substr(2, 9),
        batchNo: form.batchNo || "DEFAULT",
        mfgDate: form.mfgDate,
        expiryDate: form.expiryDate,
        quantity: Number(form.quantity) || 0
      };
      updateProduct(existingProduct.id, {
        ...existingProduct,
        batches: [...(existingProduct.batches ?? []), newBatch]
      });
      toast({ title: "New Batch Added" });
    } else {
      const newBatch: Batch = {
        id: Math.random().toString(36).substr(2, 9),
        batchNo: form.batchNo || "DEFAULT",
        mfgDate: form.mfgDate,
        expiryDate: form.expiryDate,
        quantity: Number(form.quantity) || 0
      };
      addProduct({ ...form, batches: [newBatch] } as any);
      toast({ title: "Product Created" });
    }
    
    closeDialog();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gradient">Inventory</h1>
        {/* ADD PRODUCT GUARD */}
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
                    <h3 className="font-semibold text-sm">{p.name}</h3>
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
                      {/* EDIT PRODUCT GUARD */}
                      {hasPermission('inventory.edit') && (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditId(p.id); setForm({...p, batchNo: '', quantity: 0} as any); setDialogOpen(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {/* DELETE PRODUCT GUARD */}
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
                      <TableRow className="border-white/10">
                        <TableHead className="h-8 text-[10px]">Batch No</TableHead>
                        <TableHead className="h-8 text-[10px]">Mfg/Exp</TableHead>
                        <TableHead className="h-8 text-[10px] text-right">Qty</TableHead>
                        {/* Only show header if user can edit batches */}
                        {hasPermission('inventory.edit') && <TableHead className="h-8 text-[10px] text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.batches?.map(b => (
                        <TableRow key={b.id} className="border-white/5">
                          <TableCell className="py-2 text-xs font-mono text-primary">{b.batchNo}</TableCell>
                          <TableCell className="py-2 text-xs">{formatDate(b.mfgDate)} - {formatDate(b.expiryDate)}</TableCell>
                          <TableCell className="py-2 text-right font-bold text-xs">{b.quantity}</TableCell>
                          
                          {/* EDIT BATCH GUARD */}
                          {hasPermission('inventory.edit') && (
                            <TableCell className="py-2 text-right">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                setEditId(p.id);
                                setEditingBatchId(b.id);
                                setForm({ ...p, batchNo: b.batchNo, quantity: b.quantity, mfgDate: b.mfgDate, expiryDate: b.expiryDate } as any);
                                setDialogOpen(true);
                              }}>
                                <Edit className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          )}
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
                        "w-full justify-between bg-accent/20 border-white/10 font-normal h-10",
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
                        onValueChange={(val) => setForm(f => ({ ...f, sku: val.toUpperCase() }))}
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
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-accent/20 border-white/10" />
              </div>
            </div>

            {(!editId || editingBatchId) && (
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-primary/20 bg-primary/5 p-4 rounded-lg">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-primary">Batch No</Label>
                  <Input value={form.batchNo} onChange={e => setForm({...form, batchNo: e.target.value.toUpperCase()})} className="bg-background/50 border-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-primary">Quantity</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: +e.target.value})} className="bg-background/50 border-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-primary">Mfg</Label>
                  <Input type="month" value={form.mfgDate} onChange={e => setForm({...form, mfgDate: e.target.value})} className="bg-background/50 border-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-primary">Exp</Label>
                  <Input type="month" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} className="bg-background/50 border-primary/20" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Price ({currencySymbol})</Label>
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} className="bg-accent/20 border-white/10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cost ({currencySymbol})</Label>
                <Input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: +e.target.value })} className="bg-accent/20 border-white/10" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} className="px-10">{editingBatchId ? 'Update Batch' : editId ? 'Save Product' : 'Register'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;