export const resetDatabase = () => {
  // ⚠️ WARNING: This wipes everything!
  const confirmReset = window.confirm(
    "Are you sure? This will delete ALL bills and reset ALL stock to zero."
  );

  if (confirmReset) {
    localStorage.clear(); // Wipes AppData storage for this app
    window.location.reload(); // Refresh UI to show empty state
  }
};

/**
 * Deletes a specific bill and ADDS the items back to the inventory stock
 */
export const deleteBillAndRestoreStock = (billId: string) => {
  // 1. Get current data
  const bills = JSON.parse(localStorage.getItem("omni_bills") || "[]");
  const products = JSON.parse(localStorage.getItem("omni_products") || "[]");

  // 2. Find the bill to be deleted
  const billToDelete = bills.find((b: any) => b.id === billId);
  if (!billToDelete) return;

  // 3. Update Product Stock (Add quantities back)
  const updatedProducts = products.map((product: any) => {
    // Find if this product was in the deleted bill
    const soldItem = billToDelete.items.find((item: any) => item.id === product.id);
    
    if (soldItem) {
      return {
        ...product,
        stock: Number(product.stock) + Number(soldItem.quantity)
      };
    }
    return product;
  });

  // 4. Remove the bill from history
  const updatedBills = bills.filter((b: any) => b.id !== billId);

  // 5. Save everything back to AppData
  localStorage.setItem("omni_products", JSON.stringify(updatedProducts));
  localStorage.setItem("omni_bills", JSON.stringify(updatedBills));

  alert("Bill deleted and stock restored!");
  window.location.reload();
};