import sqlite3
conn = sqlite3.connect("inventory.db")
cursor = conn.cursor()
cursor.execute("SELECT bill_no, customer_name FROM bills")
print(cursor.fetchall()) 
conn.close()