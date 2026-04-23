import sqlite3
import os

DB_PATH = "inventory.db" 

def force_fix():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Deleting old tables...")
    cursor.execute("DROP TABLE IF EXISTS bills")
    cursor.execute("DROP TABLE IF EXISTS bill_items")
    # We drop settings too to ensure the columns match your new code
    cursor.execute("DROP TABLE IF EXISTS settings")
    
    print("Recreating tables with proper columns...")
    
    # 1. Bills Table
    cursor.execute("""
        CREATE TABLE bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            total_amount REAL,
            date TEXT
        )
    """)

    # 2. Bill Items Table
    cursor.execute("""
        CREATE TABLE bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER,
            product_name TEXT,
            qty INTEGER,
            price REAL,
            FOREIGN KEY (bill_id) REFERENCES bills (id)
        )
    """)

    # 3. Settings Table (Fixes the 'theme' column error)
    cursor.execute("""
        CREATE TABLE settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            theme TEXT DEFAULT 'dark',
            low_stock_threshold INTEGER DEFAULT 10,
            very_low_stock_threshold INTEGER DEFAULT 5
        )
    """)
    
    # Insert a default row so the app has something to UPDATE
    cursor.execute("INSERT INTO settings (id, theme) VALUES (1, 'dark')")
    
    conn.commit()
    conn.close()
    print("Database fixed! Bills and Theme settings are now ready.")

if __name__ == "__main__":
    force_fix()