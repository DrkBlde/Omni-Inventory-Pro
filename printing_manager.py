import os
import qrcode
from fpdf import FPDF
from datetime import datetime

def generate_bill_pdf(bill_data, items):
    """
    Generates a PDF and a QR code for the bill.
    Saves to a 'Bills' folder automatically.
    """
    # 1. Create Folders if they don't exist
    if not os.path.exists("Bills"):
        os.makedirs("Bills")
    if not os.path.exists("Temp"):
        os.makedirs("Temp")

    bill_id = bill_data['id']
    customer = bill_data['customer_name']
    date_str = bill_data['date'].replace("/", "-").replace(":", "")
    
    # 2. Generate QR Code Image
    qr_content = f"VERIFY-DELETE-INV-{bill_id}"
    qr = qrcode.make(qr_content)
    qr_path = f"Temp/qr_{bill_id}.png"
    qr.save(qr_path)

    # 3. Create PDF
    pdf = FPDF()
    pdf.add_page()
    
    # Header
    pdf.set_font("Arial", 'B', 20)
    pdf.cell(0, 10, "INVOICE / RECEIPT", ln=True, align='C')
    pdf.ln(10)
    
    # Bill Info
    pdf.set_font("Arial", '', 12)
    pdf.cell(0, 10, f"Bill No: INV-{bill_id:03d}", ln=True)
    pdf.cell(0, 10, f"Customer: {customer}", ln=True)
    pdf.cell(0, 10, f"Date: {bill_data['date']}", ln=True)
    pdf.ln(10)

    # Table Header
    pdf.set_font("Arial", 'B', 12)
    pdf.cell(90, 10, "Item Name", border=1)
    pdf.cell(30, 10, "Qty", border=1, align='C')
    pdf.cell(30, 10, "Price", border=1, align='C')
    pdf.cell(40, 10, "Total", border=1, align='C')
    pdf.ln()

    # Table Rows
    pdf.set_font("Arial", '', 12)
    for item in items:
        total = item['qty'] * item['price']
        pdf.cell(90, 10, str(item['product_name']), border=1)
        pdf.cell(30, 10, str(item['qty']), border=1, align='C')
        pdf.cell(30, 10, f"Rs.{item['price']}", border=1, align='C')
        pdf.cell(40, 10, f"Rs.{total}", border=1, align='C')
        pdf.ln()

    # Final Total
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 14)
    pdf.cell(0, 10, f"GRAND TOTAL: Rs.{bill_data['total_amount']}", ln=True, align='R')

    # 4. Place QR Code at the bottom
    pdf.ln(10)
    pdf.set_font("Arial", 'I', 10)
    pdf.cell(0, 10, "Scan QR below to verify for Restock/Deletion:", ln=True)
    pdf.image(qr_path, x=10, y=pdf.get_y(), w=40)

    # 5. Save PDF with unique name
    file_name = f"Bills/Bill_{bill_id}_{customer}_{date_str}.pdf"
    pdf.output(file_name)
    
    # Cleanup temp QR image
    if os.path.exists(qr_path):
        os.remove(qr_path)
        
    return file_name