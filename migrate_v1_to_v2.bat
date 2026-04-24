@echo off
setlocal EnableDelayedExpansion
title Omni Inventory Pro - V1 to V2 Database Migration

:: ============================================================
::  OMNI INVENTORY PRO - V1 TO V2 DATABASE MIGRATION TOOL
::  Run this .bat file from the folder that contains your
::  V1 inventory.db file.
:: ============================================================

echo.
echo  =====================================================
echo   OMNI INVENTORY PRO - DATABASE MIGRATION TOOL
echo   V1 (Python) --^> V2 (Electron)
echo  =====================================================
echo.

:: ------------------------------------------------------------
:: STEP 1: Check Python is installed
:: ------------------------------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

:: ------------------------------------------------------------
:: STEP 2: Check V1 database exists in current directory
:: ------------------------------------------------------------
if not exist "inventory.db" (
    echo  [ERROR] inventory.db not found in current directory.
    echo  Please run this bat file from the folder that
    echo  contains your V1 inventory.db file.
    pause
    exit /b 1
)

echo  [OK] Found V1 database: %cd%\inventory.db
echo.

:: ------------------------------------------------------------
:: STEP 3: Find V2 install directory
:: ------------------------------------------------------------
set "V2_DB="

:: Check default MSI install locations
for %%P in (
    "%ProgramFiles%\Omni Inventory Pro\resources\prisma\dev.db"
    "%ProgramFiles(x86)%\Omni Inventory Pro\resources\prisma\dev.db"
    "%LocalAppData%\Programs\Omni Inventory Pro\resources\prisma\dev.db"
) do (
    if exist "%%~P" (
        set "V2_DB=%%~P"
        goto :found_v2
    )
)

:: Not found automatically - ask user
echo  [WARNING] Could not auto-detect V2 install directory.
echo.
set /p "V2_DIR=  Enter the full path to the V2 app resources folder: "
set "V2_DB=%V2_DIR%\prisma\dev.db"

if not exist "%V2_DB%" (
    echo.
    echo  [ERROR] Could not find dev.db at: %V2_DB%
    echo  Make sure Omni Inventory Pro V2 is installed and
    echo  has been launched at least once.
    pause
    exit /b 1
)

:found_v2
echo  [OK] Found V2 database: %V2_DB%
echo.

:: ------------------------------------------------------------
:: STEP 4: Confirm before proceeding
:: ------------------------------------------------------------
echo  This will migrate all data from V1 to V2:
echo    - Products (including batch, MFG date, expiry date)
echo    - Bills and bill items
echo    - Settings (low stock thresholds)
echo.
echo  The existing V2 database will be BACKED UP first.
echo  The admin user and roles in V2 will be kept.
echo.
set /p "CONFIRM=  Type YES to continue: "
if /i not "%CONFIRM%"=="YES" (
    echo.
    echo  Migration cancelled.
    pause
    exit /b 0
)

echo.
echo  Starting migration...
echo.

:: ------------------------------------------------------------
:: STEP 5: Run the Python migration script (inline)
:: ------------------------------------------------------------
python -c "
import sqlite3
import os
import sys
import shutil
from datetime import datetime, timezone

v1_path = os.path.join(os.getcwd(), 'inventory.db')
v2_path = r'%V2_DB%'

# ---- Backup V2 database ----
backup_path = v2_path + '.backup_' + datetime.now().strftime('%%Y%%m%%d_%%H%%M%%S')
shutil.copy2(v2_path, backup_path)
print(f'  [OK] V2 database backed up to: {backup_path}')

# ---- Connect to both databases ----
v1 = sqlite3.connect(v1_path)
v1.row_factory = sqlite3.Row
v2 = sqlite3.connect(v2_path)
v2.row_factory = sqlite3.Row

v1c = v1.cursor()
v2c = v2.cursor()

now_iso = datetime.now(timezone.utc).isoformat()

# ---- Helper: generate a cuid-style unique ID ----
import random, string
def cuid():
    chars = string.ascii_lowercase + string.digits
    return 'c' + ''.join(random.choices(chars, k=24))

# ================================================================
# 1. GET ADMIN USER from V2 (bills need a createdBy user ID)
# ================================================================
v2c.execute(\"SELECT id FROM User WHERE username = 'admin' LIMIT 1\")
admin_row = v2c.fetchone()
if not admin_row:
    print('  [ERROR] No admin user found in V2 database.')
    print('  Launch the V2 app once to create the admin user, then re-run.')
    v1.close()
    v2.close()
    sys.exit(1)

admin_id = admin_row['id']
print(f'  [OK] Using admin user ID: {admin_id}')

# ================================================================
# 2. MIGRATE PRODUCTS
# ================================================================
v1c.execute('SELECT * FROM products')
v1_products = v1c.fetchall()

product_id_map = {}  # v1 integer id -> v2 cuid
migrated_products = 0
skipped_products = 0

for p in v1_products:
    new_id = cuid()
    product_id_map[p['id']] = new_id

    # Build SKU from name (slugify) + original id
    raw_name = (p['name'] or 'product').lower()
    slug = ''.join(c if c.isalnum() else '-' for c in raw_name).strip('-')
    sku = f'{slug}-{p[\"id\"]}'

    # Barcode: use stored value or generate unique placeholder
    barcode = p['barcode'] if p['barcode'] and str(p['barcode']).strip() else f'BC-V1-{p[\"id\"]}'

    # Category: V1 had none, default to 'General'
    category = 'General'

    # Qty in V2 is stored on the Batch table — total qty goes into one batch
    qty = int(p['qty']) if p['qty'] else 0

    try:
        v2c.execute('''
            INSERT OR IGNORE INTO Product
            (id, name, sku, barcode, category, price, costPrice,
             lowStockThreshold, veryLowStockThreshold, unit, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            new_id,
            p['name'],
            sku,
            barcode,
            category,
            float(p['mrp']) if p['mrp'] else 0.0,
            float(p['dp']) if p['dp'] else 0.0,
            10,  # default low stock threshold
            5,   # default very low stock threshold
            'unit',
            now_iso,
            now_iso
        ))

        # Create a single Batch entry to carry the quantity
        batch_id = cuid()
        mfg  = p['mfg_date']    if p['mfg_date']    and p['mfg_date'].strip()    else '01/01/2024'
        exp  = p['expiry_date'] if p['expiry_date']  and p['expiry_date'].strip() else 'N/A'
        batch_no = p['batch'] if p['batch'] and p['batch'].strip() else 'MIGRATED'

        v2c.execute('''
            INSERT OR IGNORE INTO Batch
            (id, productId, batchNo, mfgDate, expiryDate, quantity, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (batch_id, new_id, batch_no, mfg, exp, qty, now_iso, now_iso))

        migrated_products += 1
    except Exception as e:
        print(f'  [WARN] Skipped product \"{p[\"name\"]}\": {e}')
        skipped_products += 1

print(f'  [OK] Products migrated: {migrated_products}  (skipped: {skipped_products})')

# ================================================================
# 3. MIGRATE BILLS + BILL ITEMS
# ================================================================
v1c.execute('SELECT * FROM bills ORDER BY id ASC')
v1_bills = v1c.fetchall()

bill_id_map = {}  # v1 integer id -> v2 cuid
migrated_bills = 0
skipped_bills = 0

for b in v1_bills:
    new_bill_id = cuid()
    bill_id_map[b['id']] = new_bill_id

    # Parse date - V1 format is DD/MM/YYYY HH:MM
    raw_date = b['date'] or ''
    try:
        dt = datetime.strptime(raw_date.strip(), '%%d/%%m/%%Y %%H:%%M')
        created_at = dt.replace(tzinfo=timezone.utc).isoformat()
    except:
        created_at = now_iso

    # Bill number: use V1 id offset by 1000 to avoid clashes
    bill_number = 1000 + int(b['id'])

    try:
        v2c.execute('''
            INSERT OR IGNORE INTO Bill
            (id, billNumber, total, taxableAmount, totalGst, gstPercentage,
             gstNumber, storeName, storeAddress, storePhone, billType,
             isCancelled, createdBy, createdAt, updatedAt, payments, customerName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            new_bill_id,
            bill_number,
            float(b['total_amount']) if b['total_amount'] else 0.0,
            float(b['total_amount']) if b['total_amount'] else 0.0,
            0.0,   # no GST in V1
            0.0,
            '',    # no GSTIN in V1
            'Omni Inventory',
            '',
            '',
            'Normal',
            0,
            admin_id,
            created_at,
            now_iso,
            '[]',
            b['customer_name'] or 'Walk-in'
        ))
        migrated_bills += 1
    except Exception as e:
        print(f'  [WARN] Skipped bill #{b[\"id\"]}: {e}')
        skipped_bills += 1
        continue

    # ---- Migrate bill items for this bill ----
    v1c.execute('SELECT * FROM bill_items WHERE bill_id = ?', (b['id'],))
    items = v1c.fetchall()

    for item in items:
        item_id = cuid()
        # Find matching V2 product ID by name
        v2c.execute('SELECT id FROM Product WHERE name = ? LIMIT 1', (item['product_name'],))
        prod_row = v2c.fetchone()

        # Use matched product ID or a placeholder
        prod_id = prod_row['id'] if prod_row else list(product_id_map.values())[0] if product_id_map else cuid()

        try:
            v2c.execute('''
                INSERT OR IGNORE INTO BillItem
                (id, billId, productId, name, price, quantity)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                item_id,
                new_bill_id,
                prod_id,
                item['product_name'],
                float(item['price']) if item['price'] else 0.0,
                int(item['qty']) if item['qty'] else 0
            ))
        except Exception as e:
            print(f'    [WARN] Skipped item \"{item[\"product_name\"]}\": {e}')

print(f'  [OK] Bills migrated:    {migrated_bills}  (skipped: {skipped_bills})')

# ================================================================
# 4. MIGRATE SETTINGS
# ================================================================
v1c.execute('SELECT * FROM settings WHERE id = 1')
v1_settings = v1c.fetchone()

if v1_settings:
    low  = v1_settings['low_stock_threshold']
    vlow = v1_settings['very_low_stock_threshold']

    for key, val in [
        ('low_stock_threshold',       str(low)),
        ('very_low_stock_threshold',  str(vlow)),
    ]:
        v2c.execute('''
            INSERT INTO Settings (id, key, value, updatedAt)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
        ''', (cuid(), key, val, now_iso))

    print(f'  [OK] Settings migrated (low={low}, veryLow={vlow})')

# ================================================================
# 5. COMMIT AND CLOSE
# ================================================================
v2.commit()
v1.close()
v2.close()

print()
print('  Migration complete!')
print(f'  Backup saved at: {backup_path}')
"

if errorlevel 1 (
    echo.
    echo  [ERROR] Migration failed. See error above.
    echo  Your original V2 database was not modified ^(backup exists^).
    pause
    exit /b 1
)

echo.
echo  =====================================================
echo   Migration completed successfully!
echo   - Products, bills, and settings have been imported.
echo   - A backup of your original V2 database was saved.
echo   - Launch Omni Inventory Pro V2 to verify your data.
echo  =====================================================
echo.
pause
