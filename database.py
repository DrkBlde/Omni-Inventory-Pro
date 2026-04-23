import sqlite3
import os
import sys
from datetime import datetime

# Path logic for the .db file
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(BASE_DIR, "inventory.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # --- 1. HANDLE TABLE ALTERATIONS (Legacy support) ---
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN batch TEXT")
        cursor.execute("ALTER TABLE products ADD COLUMN mfg_date TEXT")
        cursor.execute("ALTER TABLE products ADD COLUMN expiry_date TEXT")
    except sqlite3.OperationalError:
        pass  # Columns already exist

    # --- 2. CREATE PRODUCTS TABLE ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            qty INTEGER DEFAULT 0,
            dp REAL,
            mrp REAL,
            barcode TEXT UNIQUE,
            batch TEXT,
            mfg_date TEXT,
            expiry_date TEXT,
            status TEXT,
            alerts TEXT
        )
    """)

    # --- 3. CREATE BILLS TABLE ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            total_amount REAL,
            date TEXT
        )
    """)

    # --- 4. CREATE BILL ITEMS TABLE ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER,
            product_name TEXT,
            qty INTEGER,
            price REAL,
            FOREIGN KEY (bill_id) REFERENCES bills (id)
        )
    """)

    # --- 5. CREATE SETTINGS TABLE (MOVED HERE) ---
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            theme TEXT DEFAULT 'dark',
            low_stock_threshold INTEGER DEFAULT 10,
            very_low_stock_threshold INTEGER DEFAULT 5
        )
    """)
    
    # Add default values
    cursor.execute("""
        INSERT OR IGNORE INTO settings (id, theme, low_stock_threshold, very_low_stock_threshold) 
        VALUES (1, 'dark', 10, 5)
    """)

    # --- 6. FINALIZE ---
    conn.commit()
    conn.close()  # THIS MUST BE THE VERY LAST LINE

def get_theme():
    conn = sqlite3.connect(DB_PATH)
    res = conn.execute("SELECT value FROM settings WHERE key='theme'").fetchone()
    conn.close()
    return res[0] if res else "dark"

def save_theme(mode):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE settings SET value = ? WHERE key = 'theme'", (mode,))
    conn.commit()
    conn.close()

def get_all_products(search_query=""):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row # This allows dictionary-like access
    cursor = conn.cursor()
    
    if search_query:
        query = "SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ?"
        cursor.execute(query, (f'%{search_query}%', f'%{search_query}%'))
    else:
        cursor.execute("SELECT * FROM products")
        
    rows = cursor.fetchall()
    conn.close()
    # Convert rows to a list of dicts
    return [dict(row) for row in rows]

def get_product_by_id(p_id):
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row # CRITICAL: Access by name like product['name']
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (p_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_product_in_db(data):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE products SET 
            name=?, qty=?, dp=?, mrp=?, barcode=?, batch=?, mfg_date=?, expiry_date=?
            WHERE id=?
        """, (data['name'], data['qty'], data['dp'], data['mrp'], 
              data['barcode'], data['batch'], data['mfg'], data['expiry'], data['id']))
        conn.commit()
        conn.close()
        return True, "Product updated successfully."
    except Exception as e:
        return False, str(e)
    
def delete_product_by_id(p_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM products WHERE id = ?", (p_id,))
        conn.commit()
        conn.close()
        return True, "Product deleted successfully."
    except Exception as e:
        return False, str(e)
    
def submit_update(self, product_id):
        from database import update_product_in_db
        
        data = {
            "id": product_id,
            "name": self.entry_name.get(),
            "barcode": self.entry_barcode.get(),
            "batch": self.entry_batch.get(),
            "qty": self.entry_qty.get(),
            "dp": self.entry_dp.get(),
            "mrp": self.entry_mrp.get(),
            "mfg": self.entry_mfg.get(),
            "expiry": self.entry_expiry.get() if self.expiry_var.get() == "Yes" else ""
        }
        
        success, msg = update_product_in_db(data)
        if success:
            from tkinter import messagebox
            messagebox.showinfo("Success", msg)
            self.show_inventory_screen()
        else:
            from tkinter import messagebox
            messagebox.showerror("Error", msg)

def get_all_bills(search_query="", order_by="id DESC"):
    import sqlite3
    # Use DB_PATH to ensure it finds the right file
    conn = sqlite3.connect(DB_PATH) 
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # We use 'id' now because that is what your fix_bills_table creates
    query = f"""
        SELECT * FROM bills 
        WHERE customer_name LIKE ? 
        ORDER BY {order_by}
    """
    
    cursor.execute(query, (f'%{search_query}%',))
    rows = cursor.fetchall()
    conn.close()
    return rows

def get_items_for_bill(inv_no):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # This fetches the specific products inside a specific bill
    cursor.execute("SELECT product_name, qty, price FROM bill_items WHERE bill_no = ?", (inv_no,))
    rows = cursor.fetchall()
    conn.close()
    return rows

def add_product_to_db(data):
    """
    Inserts a new product into the database. Barcode is now optional.
    """
    thresholds = get_stock_thresholds()
    low_val = thresholds["low"]
    very_low_val = thresholds["very_low"]
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Handle Quantity and Status Logic
        try:
            qty_int = int(data.get("qty", 0))
        except ValueError:
            qty_int = 0
            
        if qty_int <= 0:
            status = "Out of Stock"
            alerts = "REFILL"
        elif qty_int <= very_low_val:
            status = "Very Low Stock"
            alerts = "CRITICAL"
        elif qty_int <= low_val:
            status = "Low Stock"
            alerts = "Warning"
        else:
            status = "In Stock"
            alerts = "—"

        # 2. SANITIZE BARCODE (Make it optional)
        # If barcode is an empty string, convert it to None (NULL in SQL)
        raw_barcode = data.get("barcode")
        barcode_val = raw_barcode if raw_barcode and str(raw_barcode).strip() != "" else None

        # 3. Execute the Insert
        cursor.execute("""
            INSERT INTO products (name, qty, dp, mrp, barcode, batch, mfg_date, expiry_date, status, alerts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("name"),
            qty_int,
            data.get("dp"),
            data.get("mrp"),
            barcode_val,  # Using the sanitized value
            data.get("batch"),
            data.get("mfg"),
            data.get("expiry"),
            status,
            alerts
        ))
        
        conn.commit()
        conn.close()
        return True, "Product added successfully!"
        
    except sqlite3.IntegrityError:
        # This will now only trigger if a REAL duplicate barcode is entered
        return False, "Error: This Barcode already exists in inventory."
    except Exception as e:
        return False, f"Database Error: {str(e)}"
    
def finalize_bill_in_db(customer_name, items_to_bill):
    import sqlite3
    from datetime import datetime
    conn = None # Initialize so we can close it in 'finally'
    
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10) # Added timeout to prevent locking
        cursor = conn.cursor()

        # 1. Ensure tables exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bills (
                customer_name TEXT, 
                total_amount REAL, 
                date TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bill_items (
                bill_id INTEGER, 
                product_name TEXT, 
                qty INTEGER, 
                price REAL
            )
        """)

        # 2. Insert the main bill
        current_time = datetime.now().strftime("%d/%m/%Y %H:%M")
        cursor.execute("INSERT INTO bills (customer_name, total_amount, date) VALUES (?, ?, ?)", 
                       (customer_name, 0, current_time))
        
        # USE lastrowid - this is the internal ROWID we need
        bill_id = cursor.lastrowid

        total_amount = 0
        for p_id, buy_qty in items_to_bill.items():
            cursor.execute("SELECT name, mrp, qty FROM products WHERE id = ?", (p_id,))
            prod = cursor.fetchone()
            if prod:
                name, mrp, stock = prod
                total_amount += (mrp * buy_qty)
                
                # Save item linked to bill_id
                cursor.execute("INSERT INTO bill_items (bill_id, product_name, qty, price) VALUES (?, ?, ?, ?)",
                               (bill_id, name, buy_qty, mrp))
                
                # Update stock
                cursor.execute("UPDATE products SET qty = ? WHERE id = ?", (stock - buy_qty, p_id))

        # 3. Update using ROWID instead of 'id' to avoid the "No such column" error
        cursor.execute("UPDATE bills SET total_amount = ? WHERE ROWID = ?", (total_amount, bill_id))
        
        conn.commit()
        return True, f"Bill Saved! Total: ₹{total_amount}"
        
    except Exception as e:
        if conn:
            conn.rollback() # Cancel changes if it crashes
        return False, str(e)
    finally:
        if conn:
            conn.close() # CRITICAL: This prevents the "Database is locked" error
    
def fix_bills_table():
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if the table exists and what columns it has
    cursor.execute("PRAGMA table_info(bills)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'id' not in columns:
        print("Fixing bills table...")
        # If 'bill_no' exists but 'id' doesn't, we can rename or recreate
        # The easiest way to ensure a fresh start if you don't have critical data:
        cursor.execute("DROP TABLE IF EXISTS bills")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT,
                total_amount REAL,
                date TEXT
            )
        """)
        conn.commit()
    conn.close()

    if __name__ == "__main__":
        fix_bills_table()
    print("Bills table has been reset with the 'id' column.")

def delete_bill_by_id(bill_id):
    """Restores stock quantities and then deletes the bill."""
    import sqlite3
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()

        # 1. Fetch all items associated with this bill to restore stock
        cursor.execute("SELECT product_name, qty FROM bill_items WHERE bill_id = ?", (bill_id,))
        items = cursor.fetchall()

        for name, buy_qty in items:
            # Update the product table by ADDING the quantity back
            cursor.execute("""
                UPDATE products 
                SET qty = qty + ? 
                WHERE name = ?
            """, (buy_qty, name))

        # 2. Delete the main bill entry (using ROWID for safety)
        cursor.execute("DELETE FROM bills WHERE ROWID = ?", (bill_id,))
        
        # 3. Delete the associated items
        cursor.execute("DELETE FROM bill_items WHERE bill_id = ?", (bill_id,))
        
        conn.commit()
        return True, "Bill deleted and stock restored!"
        
    except Exception as e:
        if conn:
            conn.rollback()
        return False, f"Error: {str(e)}"
    finally:
        if conn:
            conn.close()

def get_bill_items(bill_id):
    """Fetches all items for a specific bill."""
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT product_name, qty, price FROM bill_items WHERE bill_id = ?", (bill_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_stock_thresholds():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT low_stock_threshold, very_low_stock_threshold FROM settings WHERE id = 1")
        row = cursor.fetchone()
        if row:
            return {"low": row[0], "very_low": row[1]}
        return {"low": 10, "very_low": 5}
    finally:
        conn.close()
    
    # Return as integers. Default to 10 and 5 if not found in DB.
    return {
        "low": int(data.get('low_stock', 10)),
        "very_low": int(data.get('very_low_stock', 5))
    }

def update_stock_thresholds(low, very_low):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        UPDATE settings 
        SET low_stock_threshold = ?, very_low_stock_threshold = ? 
        WHERE id = 1
    """, (low, very_low))
    conn.commit()
    conn.close()

def get_saved_theme():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT theme FROM settings WHERE id = 1")
        result = cursor.fetchone()
        return result[0] if result else "dark"
    except:
        return "dark"
    finally:
        conn.close()

def save_theme(mode):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE settings SET theme = ? WHERE id = 1", (mode,))
    conn.commit()
    conn.close()