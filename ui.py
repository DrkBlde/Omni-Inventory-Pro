import customtkinter as ctk

from printing_manager import generate_bill_pdf

from database import init_db, get_theme, save_theme, get_all_products, get_all_bills

from database import (
    init_db, get_theme, save_theme, get_all_products, get_all_bills,
    get_stock_thresholds, update_stock_thresholds 
)

from database import get_saved_theme

import sys, os

def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

BG_COLOR = ("#f1f5f9", "#0f172a")     # Light gray-blue vs Navy
NAV_BG = ("#0f172a", "#1e293b")      # Navy vs Lighter Navy
ACCENT = "#38bdf8"                   # Keep Accent consistent
CARD_BG = ("#ffffff", "#1e293b")     # White cards vs Navy cards
GLASS_PANEL = ("#e2e8f0", "#161e2e")  # Light gray vs Darker Navy
ERROR_RED = "#ef4444"

class InventoryUI(ctk.CTk):
    def __init__(self):
        super().__init__()

        init_db()

        saved_mode = get_saved_theme()
        ctk.set_appearance_mode(saved_mode)

        self.title("Omni Inventory Pro")
        self.iconbitmap(resource_path("app_icon.ico"))
        self.geometry("1200x800")
        self.configure(fg_color=BG_COLOR)
        

        self.setup_navbar()
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.pack(expand=True, fill="both")

        self.show_welcome_screen()

        self.next_bill_number = 1
        self.qty_vars = {}
        self.theme_switch = None
        self.temp_bill = {}
        self.theme_switch = None

    def validate_numbers(self, P):
        # Allows only digits and a single decimal point
        return P == "" or P.replace(".", "", 1).isdigit()

    def validate_date(self, P):
        # Allows only digits and slashes
        return P == "" or all(c.isdigit() or c == "/" for c in P)

    def format_date(self, event):
        entry = event.widget
        val = entry.get()
        
        # 1. Ignore if the user is pressing Backspace
        if event.keysym == "BackSpace":
            return

        # 2. Clean the value (remove extra slashes or letters just in case)
        # We only want numbers
        digits = "".join([c for c in val if c.isdigit()])
        
        # 3. Re-format based on digit count
        formatted = ""
        if len(digits) > 0:
            formatted += digits[:2]  # DD
        if len(digits) > 2:
            formatted += "/" + digits[2:4]  # /MM
        if len(digits) > 4:
            formatted += "/" + digits[4:8]  # /YYYY
            
        # 4. Update the entry field without triggering an infinite loop
        if val != formatted:
            entry.delete(0, "end")
            entry.insert(0, formatted)
    def setup_navbar(self):
        self.navbar = ctk.CTkFrame(self, height=80, fg_color=NAV_BG, corner_radius=0)
        self.navbar.pack(side="top", fill="x")
        
        # Settings Button
        self.btn_settings = ctk.CTkButton(self.navbar, text="⚙️", width=50, height=50, 
                                          fg_color="transparent", font=("Arial", 22), 
                                          hover_color="#334155", 
                                          command=self.show_settings_screen)
        self.btn_settings.pack(side="left", padx=25, pady=15)
            
        # Existing buttons
        self.btn_bills = self.create_nav_item("🧾", "right", self.show_bills_screen)
        self.btn_stock = self.create_nav_item("📦", "right", lambda: self.show_inventory_screen(False))

    def create_nav_item(self, icon, side, command):
        btn = ctk.CTkButton(self.navbar, text=icon, width=60, height=60, 
                            fg_color="transparent", font=("Arial", 28), 
                            hover_color="#334155", command=command)
        btn.pack(side=side, padx=15, pady=10)
        return btn

    def clear_screen(self):
        for widget in self.main_container.winfo_children():
            widget.destroy()

    def show_welcome_screen(self):
        self.clear_screen()
        container = ctk.CTkFrame(self.main_container, fg_color="transparent")
        container.place(relx=0.5, rely=0.5, anchor="center")
        
        # GLASS LOOK FIX: 
        # Light mode: #e2e8f0 (soft gray) 
        # Dark mode: #1e293b (lighter navy panel)
        card = ctk.CTkFrame(container, width=580, height=280, 
                            fg_color=("#e2e8f0", "#1e293b"), 
                            corner_radius=35, 
                            border_width=2, 
                            border_color="#334155")
        card.pack_propagate(False)
        card.pack(pady=10)
        
        ctk.CTkLabel(card, text="WELCOME TO", 
                     font=("Segoe UI", 22, "bold"), 
                     text_color=("#64748b", "#cbd5e1")).pack(pady=(70, 0))
        
        ctk.CTkLabel(card, text="INVENTORY", 
                     font=("Segoe UI", 72, "bold"), 
                     text_color=ACCENT).pack()
        
        # Subtitle - using Dark Navy for Light Mode and Light Gray for Dark Mode
        ctk.CTkLabel(container, text="Omni Inventory Pro", 
                     font=("Segoe UI", 30, "italic"), 
                     text_color=("#0f172a", "#94a3b8")).pack(pady=25)

    # --- THEME ---
    def toggle_theme(self):
        # 1. Determine the mode based on switch state (1 = Checked/Light, 0 = Unchecked/Dark)
        new_mode = "light" if self.theme_switch.get() == 1 else "dark"
        
        # 2. Update the switch text instantly
        self.theme_switch.configure(text=f"Current Mode: {new_mode.capitalize()}")
        
        # 3. Change Global Appearance
        ctk.set_appearance_mode(new_mode)
        
        # 4. Save to DB
        save_theme(new_mode)

    # --- SETTINGS SECTION ---

    def show_settings_screen(self):
        self.clear_screen()

        settings_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        settings_frame.pack(fill="both", expand=True, padx=40, pady=20)

        ctk.CTkLabel(settings_frame, text="Appearance Settings", font=("Segoe UI", 18, "bold")).pack(pady=(10, 5))
        
        # Use the same function name as in __init__
        from database import get_saved_theme
        current_theme = get_saved_theme() 
        
        self.theme_switch = ctk.CTkSwitch(
            settings_frame, 
            text=f"Current Mode: {current_theme.capitalize()}",
            command=self.toggle_theme
        )
        
        # CRITICAL: This syncs the physical switch to the database value
        if current_theme == "light":
            self.theme_switch.select()
        else:
            self.theme_switch.deselect()
            
        self.theme_switch.pack(pady=10)

        # --- SECTION: STOCK THRESHOLDS (The New Stuff) ---
        ctk.CTkLabel(settings_frame, text="Stock Alert Thresholds", font=("Segoe UI", 18, "bold")).pack(pady=(30, 10))
        
        thresholds = get_stock_thresholds()

        # Low Stock Entry
        ctk.CTkLabel(settings_frame, text="Low Stock Warning Level:", font=("Segoe UI", 12)).pack()
        self.low_stock_entry = ctk.CTkEntry(settings_frame, width=200)
        self.low_stock_entry.insert(0, str(thresholds["low"]))
        self.low_stock_entry.pack(pady=5)

        # Very Low Stock Entry
        ctk.CTkLabel(settings_frame, text="Very Low Stock (Critical) Level:", font=("Segoe UI", 12)).pack()
        self.very_low_stock_entry = ctk.CTkEntry(settings_frame, width=200)
        self.very_low_stock_entry.insert(0, str(thresholds["very_low"]))
        self.very_low_stock_entry.pack(pady=5)

        ctk.CTkButton(settings_frame, text="Save Thresholds", 
                      fg_color="#10B981", hover_color="#059669",
                      command=self.save_threshold_settings).pack(pady=20)

        # --- SECTION: FOOTER (Omni Inventory Pro V1.0.0) ---
        footer = ctk.CTkFrame(settings_frame, fg_color="transparent")
        footer.pack(side="bottom", fill="x", pady=20)
        
        ctk.CTkLabel(footer, text="Omni Inventory Pro", font=("Segoe UI", 14, "bold")).pack()
        ctk.CTkLabel(footer, text="Version 1.0.0", font=("Segoe UI", 12), text_color="gray").pack()

    def save_threshold_settings(self):
        low = self.low_stock_entry.get()
        v_low = self.very_low_stock_entry.get()
        
        # This calls the function you just added to database.py
        update_stock_thresholds(low, v_low)
        
        from tkinter import messagebox
        messagebox.showinfo("Success", "Thresholds updated successfully!")

    # --- BILLS & PURCHASES SECTION ---
    def show_bills_screen(self):
        """Displays Sales History with Dynamic Theme styling for both Light and Dark modes."""
        # 1. Clear main container
        for widget in self.main_container.winfo_children():
            widget.destroy()
            
        # 2. Use Dynamic Colors for the background (Light Grey, Dark Navy)
        bg_color = ("#F1F5F9", "#0F172A")
        self.main_container.configure(fg_color=bg_color)
            
        # --- HEADER SECTION ---
        header = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header.pack(fill="x", padx=40, pady=(30, 10))
        
        # Title: (Dark Navy for Light mode, White for Dark mode)
        title_color = ("#1E293B", "#F8FAFC")
        ctk.CTkLabel(header, text="SALES HISTORY", 
                     font=("Segoe UI", 28, "bold"), 
                     text_color=title_color).pack(side="left")

        # --- SEARCH BAR & DROPDOWN STYLING ---
        # Card style colors: (White for Light, Dark Slate for Dark)
        card_bg = ("#FFFFFF", "#1E293B")
        card_border = ("#E2E8F0", "#334155")
        text_main = ("#1E293B", "#F8FAFC")

        self.bill_search_var = ctk.StringVar()
        self.bill_search_var.trace_add("write", lambda *args: self.refresh_bills_list())
        
        search_entry = ctk.CTkEntry(header, placeholder_text="Search Customer...", 
                                    width=280, height=40, font=("Segoe UI", 13),
                                    fg_color=card_bg, border_color=card_border,
                                    text_color=text_main,
                                    textvariable=self.bill_search_var)
        search_entry.pack(side="left", padx=30)

        # New Bill Button
        ctk.CTkButton(header, text="+ New Bill", corner_radius=12, 
                      fg_color="#22C55E", hover_color="#16A34A",
                      font=("Segoe UI", 14, "bold"), height=40,
                      command=lambda: self.show_inventory_screen(billing_mode=True)).pack(side="right")

        # Sorting Dropdown
        sort_options = ["Most Recent", "Oldest", "Bill No (High-Low)", "Bill No (Low-High)"]
        self.bill_sort_var = ctk.StringVar(value="Most Recent")
        
        sort_menu = ctk.CTkOptionMenu(header, values=sort_options, 
                                      variable=self.bill_sort_var,
                                      width=160, height=40,
                                      fg_color=card_bg, text_color=text_main,
                                      button_color=card_border, button_hover_color=("#CBD5E1", "#475569"),
                                      dropdown_fg_color=card_bg, dropdown_text_color=text_main,
                                      command=lambda _: self.refresh_bills_list())
        sort_menu.pack(side="right", padx=10)

        # --- THE MAIN TABLE CARD ---
        container = ctk.CTkFrame(self.main_container, 
                                 fg_color=card_bg, 
                                 corner_radius=15,
                                 border_width=1,
                                 border_color=card_border)
        container.pack(fill="both", expand=True, padx=30, pady=20)

        # Table Headers Row
        t_header = ctk.CTkFrame(container, fg_color="transparent", height=45)
        t_header.pack(fill="x", padx=20, pady=(15, 5))
        
        # Muted header text: (Grey for Light, Slate-400 for Dark)
        header_text_color = ("#64748B", "#94A3B8")
        headers = [("Bill No", 100), ("Customer", 300), ("Date", 220), ("Total", 150), ("Action", 150)]
        for text, width in headers:
            ctk.CTkLabel(t_header, text=text.upper(), width=width, 
                         font=("Segoe UI", 12, "bold"), 
                         text_color=header_text_color, anchor="w").pack(side="left", padx=10)

        # Scrollable Area for Rows
        self.bill_scroll = ctk.CTkScrollableFrame(container, fg_color="transparent")
        self.bill_scroll.pack(fill="both", expand=True, padx=5, pady=5)

        self.refresh_bills_list()

    def refresh_bills_list(self):
        """Refreshes the list with sorted bill data using Dynamic styling for Light and Dark modes."""
        # 1. Clear existing rows
        for widget in self.bill_scroll.winfo_children():
            widget.destroy()

        try:
            from database import get_all_bills
            
            # 2. Get search query
            search_query = self.bill_search_var.get() if hasattr(self, 'bill_search_var') else ""
            
            # 3. Handle Sorting Logic
            sort_selection = self.bill_sort_var.get() if hasattr(self, 'bill_sort_var') else "Most Recent"
            
            sort_map = {
                "Most Recent": "id DESC",
                "Oldest": "id ASC",
                "Bill No (High-Low)": "id DESC",
                "Bill No (Low-High)": "id ASC"
            }
            order_by = sort_map.get(sort_selection, "id DESC")

            # 4. Fetch bills
            bills = get_all_bills(search_query, order_by=order_by)
            
            # Define Dynamic Text Colors
            text_main = ("#1E293B", "#F8FAFC")   # Dark Navy / White
            text_muted = ("#64748B", "#94A3B8")  # Grey / Light Slate
            
            if not bills:
                ctk.CTkLabel(self.bill_scroll, text="No matching bills found.", 
                             text_color=text_muted, font=("Segoe UI", 14)).pack(pady=40)
                return

            # 5. Build the rows
            for bill in bills:
                b_id = bill['id']
                
                # Row frame - Keep transparent
                row = ctk.CTkFrame(self.bill_scroll, fg_color="transparent", height=55)
                row.pack(fill="x", padx=10, pady=2)

                # Column 1: Bill ID (Muted Dynamic)
                ctk.CTkLabel(row, text=f"#{b_id}", width=100, anchor="w", 
                             text_color=text_muted, font=("Segoe UI", 14)).pack(side="left", padx=10)
                
                # Column 2: CUSTOMER NAME (Bold Main Dynamic)
                ctk.CTkLabel(row, text=bill['customer_name'], width=300, anchor="w",
                             text_color=text_main, font=("Segoe UI", 15, "bold")).pack(side="left", padx=10)
                
                # Column 3: Date (Muted Dynamic)
                ctk.CTkLabel(row, text=bill['date'], width=220, anchor="w",
                             text_color=text_muted, font=("Segoe UI", 14)).pack(side="left", padx=10)
                
                # Column 4: Total Amount (Vibrant Green - looks good in both modes)
                ctk.CTkLabel(row, text=f"₹{bill['total_amount']}", width=150, anchor="w", 
                             text_color="#10B981", font=("Segoe UI", 16, "bold")).pack(side="left", padx=10)
                
                # Column 5: Action Buttons
                # View Button
                ctk.CTkButton(row, text="View", width=70, height=30,
                              fg_color="#3B82F6", hover_color="#2563EB",
                              font=("Segoe UI", 12, "bold"), corner_radius=8,
                              command=lambda b=bill: self.view_specific_bill(b)).pack(side="left", padx=5)
                
                # Delete Button
                ctk.CTkButton(row, text="🗑", width=40, height=30, 
                              fg_color="#EF4444", hover_color="#DC2626",
                              font=("Segoe UI", 14), corner_radius=8,
                              command=lambda val=b_id: self.show_qr_verification_modal(val)).pack(side="left", padx=5)
                
        except Exception as e:
            ctk.CTkLabel(self.bill_scroll, text=f"Error: {e}", 
                         text_color="#EF4444", font=("Segoe UI", 14)).pack(pady=20)

    def confirm_delete_bill(self, bill_id):
        """Asks for confirmation and refreshes UI after restoration."""
        from tkinter import messagebox
        if messagebox.askyesno("Confirm Delete", f"Delete Bill #{bill_id} and return items to stock?"):
            from database import delete_bill_by_id
            success, msg = delete_bill_by_id(bill_id)
            
            if success:
                messagebox.showinfo("Success", msg)
                # Refresh the current view
                self.refresh_bills_list() 
            else:
                messagebox.showerror("Error", msg)
            
    def view_specific_bill(self, bill):
        """Displays the details of a past transaction with PDF Printing."""
        self.clear_screen()
        
        # NEW: Fetch items for this specific bill so the PDF has data to show
        from database import get_bill_items
        purchased_items = get_bill_items(bill['id'])
        
        # Header Area
        header = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header.pack(fill="x", padx=50, pady=30)
        ctk.CTkButton(header, text="← Back", width=100, command=self.show_bills_screen).pack(side="left")
        ctk.CTkLabel(header, text=f"BILL DETAILS: #{bill['id']}", font=("Segoe UI", 24, "bold")).pack(side="left", padx=20)

        # Receipt Card
        receipt = ctk.CTkFrame(self.main_container, fg_color=GLASS_PANEL, corner_radius=15, width=500)
        receipt.pack(pady=10, padx=50, fill="y")

        # Customer Info Section
        ctk.CTkLabel(receipt, text="CUSTOMER INFORMATION", font=("Segoe UI", 12, "bold"), text_color=ACCENT).pack(pady=(20, 5))
        ctk.CTkLabel(receipt, text=f"Name: {bill['customer_name']}", font=("Segoe UI", 16)).pack()
        ctk.CTkLabel(receipt, text=f"Date: {bill['date']}", font=("Segoe UI", 12), text_color="#94a3b8").pack(pady=(0, 20))

        # --- PRODUCT LIST DISPLAY (Added this so you can see what's in the bill) ---
        prod_list_frame = ctk.CTkFrame(receipt, fg_color="transparent")
        prod_list_frame.pack(fill="x", padx=40)
        for item in purchased_items:
            item_row = ctk.CTkLabel(prod_list_frame, 
                                    text=f"{item['product_name']} x{item['qty']} - ₹{item['price'] * item['qty']}",
                                    font=("Segoe UI", 16), text_color="#94a3b8")
            item_row.pack(anchor="w")

        # Total Amount Highlight
        divider = ctk.CTkFrame(receipt, height=2, fg_color="#334155")
        divider.pack(fill="x", padx=40, pady=10)
        
        ctk.CTkLabel(receipt, text="TOTAL PAYABLE", font=("Segoe UI", 12, "bold")).pack()
        ctk.CTkLabel(receipt, text=f"₹{bill['total_amount']}", font=("Segoe UI", 32, "bold"), text_color="#22c55e").pack(pady=10)

        # --- UPDATED PRINT BUTTON ---
        ctk.CTkButton(receipt, text="🖨️ Print & Save PDF", 
                      fg_color="#22c55e", hover_color="#16a34a", 
                      font=("Segoe UI", 14, "bold"), height=40,
                      command=lambda: self.handle_print(bill, purchased_items)).pack(pady=30)

    def generate_bill_id(self, number):
        return f"INV-{number}"

    def refresh_bill_list(self, filter_text=""):
        # Clear current rows
        for widget in self.bill_scroll.winfo_children():
            widget.destroy()

        # Fetch real data from database
        from database import get_all_bills
        bills = get_all_bills(filter_text)

        if not bills:
            # Show a "No Data" message if the database is empty
            ctk.CTkLabel(self.bill_scroll, 
                         text="No purchase history found.", 
                         font=("Segoe UI", 16),
                         text_color=("#475569", "#94a3b8")).pack(pady=40)
        else:
            for bill in bills:
                # bill will be a tuple: (inv_no, date, customer, items, total)
                self.add_bill_row(*bill)

    def add_bill_row(self, inv_no, date, customer, items, total):
        # FIX: The row background now flips: (Light Blue, Dark Navy)
        row = ctk.CTkFrame(self.bill_scroll, 
                           fg_color=("#dbeafe", "#1e293b"), 
                           height=75, corner_radius=15)
        row.pack(fill="x", pady=5, padx=10)
        row.pack_propagate(False)

        ctk.CTkLabel(row, text=inv_no, width=120, anchor="w", 
                     font=("Segoe UI", 14, "bold"),
                     text_color=("#1e293b", "white")).pack(side="left", padx=10)
        
        ctk.CTkLabel(row, text=customer, width=280, anchor="w", 
                     font=("Segoe UI", 14, "bold"),
                     text_color=("#1e293b", "white")).pack(side="left", padx=10)
        
        # Date
        ctk.CTkLabel(row, text=date, width=130, font=("Segoe UI", 14)).pack(side="left", padx=10)
        
        # Items Count
        ctk.CTkLabel(row, text=items, width=80, font=("Segoe UI", 14)).pack(side="left", padx=10)
        
        # Total
        ctk.CTkLabel(row, text=total, width=140, font=("Segoe UI", 14, "bold"), text_color=ACCENT).pack(side="left", padx=10)

        # Actions
        actions = ctk.CTkFrame(row, fg_color="transparent")
        actions.pack(side="right", padx=10)
        
        # View Button (Passes the 4 main variables to the next screen)
        ctk.CTkButton(actions, text="👁 View", width=70, height=30, fg_color="#334155", 
                      command=lambda: self.show_bill_details(inv_no, customer, items, total)).pack(side="left", padx=5)
        
        ctk.CTkButton(actions, text="🖨️ Print", width=70, height=30, fg_color="#334155", 
                      command=lambda: print(f"Printing {inv_no}")).pack(side="left", padx=5)
        
        ctk.CTkButton(actions, text="🗑️ Delete", width=70, height=30, fg_color="#450a0a", text_color="#f87171",
                      command=lambda: self.show_qr_verification(inv_no)).pack(side="left", padx=5)
        
    def handle_print(self, bill, items):
        """Generates the PDF and opens it. Includes error popups."""
        try:
            from printing_manager import generate_bill_pdf
            import os
            
            # Generate the file
            file_path = generate_bill_pdf(bill, items)
            
            # Verify the file actually exists before trying to open it
            if os.path.exists(file_path):
                # Use absolute path to avoid Windows 'File Not Found' errors
                abs_path = os.path.abspath(file_path)
                os.startfile(abs_path)
            else:
                from tkinter import messagebox
                messagebox.showerror("Error", "PDF was not created. Check folder permissions.")
                
        except Exception as e:
            from tkinter import messagebox
            messagebox.showerror("Print Error", f"Something went wrong: {str(e)}")
            print(f"DEBUG ERROR: {e}") # This shows the error in your terminal
        
    def show_qr_verification_modal(self, bill_id):
        """Displays a QR verification screen with Dynamic Theme support and NO duplicate buttons."""
        import cv2
        
        # 1. DESTROY OLD WINDOW IF IT EXISTS (Prevents stacking/doubling)
        if hasattr(self, 'qr_window') and self.qr_window.winfo_exists():
            self.qr_window.destroy()

        self.qr_window = ctk.CTkToplevel(self)
        self.qr_window.title("Verification")
        self.qr_window.geometry("550x650")
        
        # --- DYNAMIC COLORS ---
        bg_color = ("#F1F5F9", "#0F172A")
        text_main = ("#1E293B", "#F8FAFC")
        card_bg = ("#FFFFFF", "#1E293B")
        video_bg = ("#E2E8F0", "#1E293B")
        
        self.qr_window.configure(fg_color=bg_color) 
        self.qr_window.attributes("-topmost", True)
        self.qr_window.grab_set()

        # Title
        ctk.CTkLabel(self.qr_window, text="QR VERIFICATION", 
                     font=("Segoe UI", 24, "bold"), 
                     text_color=text_main).pack(pady=(25, 5))
        
        # --- CAMERA SELECTION ROW ---
        cam_list = self.get_available_cameras()
        self.active_scan_cam = ctk.StringVar(value=cam_list[0])
        
        cam_frame = ctk.CTkFrame(self.qr_window, fg_color="transparent")
        cam_frame.pack(pady=10)
        
        ctk.CTkOptionMenu(
            cam_frame, values=cam_list, variable=self.active_scan_cam, 
            width=150, fg_color=card_bg, text_color=text_main,
            button_color=("#E2E8F0", "#334155"), 
            button_hover_color=("#CBD5E1", "#475569")
        ).pack(side="left", padx=10)

        ctk.CTkButton(
            cam_frame, text="Start Cam", width=120, height=35,
            fg_color="#10B981", hover_color="#059669", 
            font=("Segoe UI", 13, "bold"),
            command=lambda: self.start_modal_camera(bill_id)
        ).pack(side="left")

        # --- VIDEO DISPLAY ---
        video_border = ctk.CTkFrame(self.qr_window, width=406, height=306, 
                                    fg_color="#38bdf8", corner_radius=15)
        video_border.pack(pady=20)
        video_border.pack_propagate(False)

        self.video_display = ctk.CTkLabel(
            video_border, text="[ CAMERA OFFLINE ]", 
            width=400, height=300, 
            fg_color=video_bg, 
            text_color=("#64748B", "#94A3B8"),
            corner_radius=12
        )
        self.video_display.place(relx=0.5, rely=0.5, anchor="center")

        # --- THE ONLY ACTION BUTTON FRAME ---
        # Make sure there is NO OTHER 'btn_frame' code below this!
        btn_frame = ctk.CTkFrame(self.qr_window, fg_color="transparent")
        btn_frame.pack(pady=20)

        # Close/Cancel Button
        ctk.CTkButton(
            btn_frame, text="Close / Cancel", 
            width=140, height=40,
            fg_color=("#475569", "#334155"), 
            hover_color=("#334155", "#1E293B"),
            command=self.qr_window.destroy
        ).pack(side="left", padx=10)

        # Reset Button (calls the fixed method we added)
        ctk.CTkButton(
            btn_frame, text="Reset Cam", 
            width=140, height=40,
            fg_color="#6366F1", hover_color="#4F46E5",
            command=self.reset_modal_camera 
        ).pack(side="left", padx=10)

        def close_modal():
            if hasattr(self, 'modal_cap'): 
                self.modal_cap.release()
            if hasattr(self, 'scan_loop_id'):
                self.after_cancel(self.scan_loop_id)
            self.qr_window.destroy()

    def start_modal_camera(self, bill_id):
        """Initializes the camera selected in the modal."""
        import cv2
        try:
            cam_idx = int(self.active_scan_cam.get().split(" ")[1])
            self.modal_cap = cv2.VideoCapture(cam_idx)
            self.run_modal_scan_loop(bill_id)
        except Exception as e:
            print(f"Cam Error: {e}")

    def reset_modal_camera(self):
        """Stops and clears the camera resources."""
        if hasattr(self, 'cap') and self.cap is not None:
            self.cap.release()
            self.cap = None
        self.video_display.configure(text="[ CAMERA RESET ]")

    def run_modal_scan_loop(self, bill_id):
        import cv2
        from pyzbar import pyzbar
        from PIL import Image

        if not hasattr(self, 'modal_cap') or not self.modal_cap.isOpened():
            return

        ret, frame = self.modal_cap.read()
        if ret:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            codes = pyzbar.decode(gray)
            
            for code in codes:
                data = code.data.decode("utf-8").strip()
                
                if str(bill_id) in data and "VERIFY" in data:
                    print(f"Match Found: {data}")
                    
                    # --- CRITICAL CLEANUP STEPS ---
                    if hasattr(self, 'scan_loop_id'):
                        self.after_cancel(self.scan_loop_id) # Stop the loop first
                    
                    self.modal_cap.release() # Turn off camera hardware
                    cv2.destroyAllWindows()
                    self.qr_window.destroy() # Close the scanning window
                    
                    # Now that the UI is clear, run the deletion
                    if hasattr(self, 'execute_verified_deletion'):
                        # Use .after to give the UI a millisecond to breathe
                        self.after(100, lambda: self.execute_verified_deletion(bill_id))
                    return

            # Display Logic (using CTkImage for scaling)
            frame = cv2.flip(frame, 1)
            cv2_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(cv2_image)
            ctk_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(400, 300))
            
            try:
                self.video_display.configure(image=ctk_img, text="")
                self.video_display.image = ctk_img 
            except:
                return 

        self.scan_loop_id = self.qr_window.after(10, lambda: self.run_modal_scan_loop(bill_id))

    def execute_verified_deletion(self, bill_id):
        from database import delete_bill_by_id
        from tkinter import messagebox
        
        success, msg = delete_bill_by_id(bill_id)
        
        if success:
            # This popup will no longer freeze because the camera is already dead
            messagebox.showinfo("Verified", f"Success! Bill #{bill_id} deleted and stock restored.")
            
            # Refresh the sales history screen automatically
            self.show_bills_screen() 
        else:
            messagebox.showerror("Error", msg)
        
    def show_bill_details(self, inv_no, customer, item_count, total_amt):
        self.clear_screen()
        
        # --- HEADER ---
        header = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header.pack(fill="x", padx=50, pady=30)
        
        ctk.CTkButton(header, text="← Back", width=80, 
                      command=self.show_bills_screen).pack(side="left")
        
        ctk.CTkLabel(header, text=f"BILL PREVIEW: {inv_no}", 
                     font=("Segoe UI", 24, "bold"),
                     text_color=("#1e293b", "white")).pack(side="left", padx=20)

        # --- RECEIPT CONTAINER ---
        receipt = ctk.CTkFrame(self.main_container, fg_color=GLASS_PANEL, width=600, corner_radius=25)
        receipt.pack(pady=10, padx=50, fill="y", expand=True)

        ctk.CTkLabel(receipt, text="OMNI-INVENTORY PRO", 
                     font=("Courier", 22, "bold"),
                     text_color=("#1e293b", "white")).pack(pady=(30, 5))
        
        ctk.CTkLabel(receipt, text=f"Customer: {customer}", 
                     font=("Courier", 16),
                     text_color=("#475569", "#94a3b8")).pack()
        
        ctk.CTkLabel(receipt, text="------------------------------------------", 
                     font=("Courier", 14),
                     text_color=("#1e293b", "white")).pack(pady=10)

        # --- DYNAMIC PRODUCT LIST ---
        from database import get_items_for_bill
        products_purchased = get_items_for_bill(inv_no)

        if not products_purchased:
            ctk.CTkLabel(receipt, text="[ No items found for this bill ]", 
                         font=("Courier", 14), text_color=ERROR_RED).pack(pady=20)
        else:
            # Table Header
            t_header = ctk.CTkFrame(receipt, fg_color="transparent")
            t_header.pack(fill="x", padx=60, pady=5)
            ctk.CTkLabel(t_header, text="ITEM", font=("Courier", 14, "bold"), width=250, anchor="w", text_color=("#1e293b", "white")).pack(side="left")
            ctk.CTkLabel(t_header, text="QTY", font=("Courier", 14, "bold"), width=50, text_color=("#1e293b", "white")).pack(side="left")
            ctk.CTkLabel(t_header, text="PRICE", font=("Courier", 14, "bold"), width=100, anchor="e", text_color=("#1e293b", "white")).pack(side="right")

            for name, qty, price in products_purchased:
                p_row = ctk.CTkFrame(receipt, fg_color="transparent")
                p_row.pack(fill="x", padx=60, pady=2)
                ctk.CTkLabel(p_row, text=name, font=("Courier", 14), width=250, anchor="w", text_color=("#1e293b", "white")).pack(side="left")
                ctk.CTkLabel(p_row, text=str(qty), font=("Courier", 14), width=50, text_color=("#1e293b", "white")).pack(side="left")
                ctk.CTkLabel(p_row, text=f"₹{price}", font=("Courier", 14), width=100, anchor="e", text_color=("#1e293b", "white")).pack(side="right")

        ctk.CTkLabel(receipt, text="------------------------------------------", 
                     font=("Courier", 14),
                     text_color=("#1e293b", "white")).pack(pady=10)
        
        # Bottom Summary
        ctk.CTkLabel(receipt, text=f"Total Items: {item_count}", 
                     font=("Courier", 16),
                     text_color=("#1e293b", "white")).pack(pady=5)
        
        ctk.CTkLabel(receipt, text=f"TOTAL: ₹{total_amt}", 
                     font=("Segoe UI", 26, "bold"), text_color=ACCENT).pack(pady=30)

    def show_bill_detail_view(self, bno, customer, total, error_msg=None):
        self.clear_screen()
        
        # --- PREPARE DATA FOR PRINTING ---
        # We need to fetch the actual items from the database using the bill number (bno)
        from database import get_bill_items
        purchased_items = get_bill_items(bno) 
        
        # Create a dictionary that matches the format the printer expects
        # We assume bno is the ID, and we add a date (you might want to pass the real date here)
        from datetime import datetime
        bill_data = {
            'id': bno,
            'customer_name': customer,
            'total_amount': total,
            'date': datetime.now().strftime("%d/%m/%Y %H:%M") 
        }

        top_bar = ctk.CTkFrame(self.main_container, fg_color="transparent")
        top_bar.pack(fill="x", padx=50, pady=30)

        ctk.CTkButton(top_bar, text="← Back to Bills", corner_radius=15, 
                      fg_color=ACCENT, text_color="black", font=("Segoe UI", 14, "bold"), 
                      height=40, command=self.show_bills_screen).pack(side="left")

        btn_group = ctk.CTkFrame(top_bar, fg_color="transparent")
        btn_group.pack(side="right")

        # --- UPDATED PRINT BUTTON ---
        ctk.CTkButton(btn_group, text="🖨️ Print Bill", fg_color="#334155", width=120, height=40,
                      # Calls handle_print with our prepared data
                      command=lambda: self.handle_print(bill_data, purchased_items)).pack(side="left", padx=10)

        # Delete & Restock Button
        ctk.CTkButton(btn_group, text="🗑️ Delete & Restock", fg_color=ERROR_RED, width=150, height=40,
                      command=lambda: self.open_scan_tab(bno, customer, total)).pack(side="left")

        # Error Display
        if error_msg:
            err_box = ctk.CTkFrame(self.main_container, fg_color="#450a0a", height=40, corner_radius=10)
            err_box.pack(fill="x", padx=50, pady=(0, 20))
            ctk.CTkLabel(err_box, text=f"⚠️ {error_msg}", text_color="#f87171", font=("Segoe UI", 13, "bold")).pack(pady=5)

        preview_card = ctk.CTkFrame(self.main_container, fg_color=CARD_BG, corner_radius=30, border_width=1, border_color="#334155")
        preview_card.pack(fill="both", expand=True, padx=50, pady=(0, 50))

        ctk.CTkLabel(preview_card, text=f"BILL: {bno}", font=("Segoe UI", 32, "bold"), text_color=ACCENT).pack(pady=(40, 5))
        ctk.CTkLabel(preview_card, text=f"Customer: {customer}", font=("Segoe UI", 18), text_color="white").pack()

        prod_box = ctk.CTkFrame(preview_card, fg_color="#161e2e", corner_radius=20)
        prod_box.pack(expand=True, fill="both", padx=40, pady=30)
        
        # --- SHOW ACTUAL ITEMS IN UI ---
        items_header = f"{'PRODUCT NAME':<30} | {'QTY':<3} | {'PRICE':<8}\n" + ("-" * 50)
        items_list = ""
        for item in purchased_items:
            name = item['product_name'][:28] # Truncate long names
            items_list += f"\n{name:<30} | {item['qty']:<3} | ₹{item['price']:<8}"
        
        ctk.CTkLabel(prod_box, text=f"{items_header}{items_list}", 
                      font=("Consolas", 14), text_color="#94a3b8", justify="left").pack(expand=True, pady=20)

        ctk.CTkLabel(preview_card, text=f"GRAND TOTAL: {total}", 
                      font=("Segoe UI", 24, "bold"), text_color=ACCENT).pack(pady=(0, 40))

    # --- NEW SCAN TAB LOGIC ---
    def open_scan_tab(self, bno, customer, total):
        import cv2
        from pyzbar import pyzbar
        from pyzbar.pyzbar import ZBarSymbol
        from PIL import Image, ImageTk
        
        self.clear_screen()
        
        # Container
        scan_container = ctk.CTkFrame(self.main_container, fg_color=BG_COLOR)
        scan_container.pack(expand=True, fill="both")

        # Header Text
        ctk.CTkLabel(scan_container, text="QR VERIFICATION REQUIRED", 
                     font=("Segoe UI", 24, "bold"), text_color="white").pack(pady=(60, 10))
        ctk.CTkLabel(scan_container, text=f"Scan the QR code on the bill for INV-{bno}\nto authorize restock and deletion.", 
                     font=("Segoe UI", 16), text_color="#94a3b8").pack(pady=10)

        # Video Feed Label (The "Scanner" box from your screenshot)
        self.video_label = ctk.CTkLabel(scan_container, text="", width=450, height=350, 
                                        fg_color="black", corner_radius=20, border_width=2, border_color=ACCENT)
        self.video_label.pack(pady=20)

        # Initialize Camera
        self.cap = cv2.VideoCapture(0) 

        def scan_step():
            if not hasattr(self, 'cap') or not self.cap.isOpened():
                return

            ret, frame = self.cap.read()
            if ret:
                # 1. Convert to Gray for faster/better QR detection
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                # 2. Decode ONLY QR Codes to stay focused
                codes = pyzbar.decode(gray, symbols=[ZBarSymbol.QRCODE])
                
                for code in codes:
                    data = code.data.decode("utf-8")
                    
                    # 3. Validation Logic: Matches the string from printing_manager.py
                    if data == f"VERIFY-DELETE-INV-{bno}":
                        self.cap.release()
                        self.process_verified_deletion(bno) # Jump to deletion
                        return

                # 4. Display the live feed in the UI
                # Flip the image so it acts like a mirror (easier for the user)
                frame = cv2.flip(frame, 1)
                cv2_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
                img = Image.fromarray(cv2_image).resize((450, 350))
                imgtk = ImageTk.PhotoImage(image=img)
                self.video_label.configure(image=imgtk)
                self.video_label.image = imgtk
            
            # Repeat every 10ms to keep the video smooth
            self.scan_job = self.after(10, scan_step)

        # Start the loop
        scan_step()

        # Cancel Button
        ctk.CTkButton(scan_container, text="Cancel & Go Back", fg_color="#334155", 
                      width=200, height=45,
                      command=lambda: self.cancel_scan(bno, customer, total)).pack(pady=30)

    def cancel_scan(self, bno, customer, total):
        """Releases camera and returns to detail view."""
        if hasattr(self, 'cap'):
            self.cap.release()
        if hasattr(self, 'scan_job'):
            self.after_cancel(self.scan_job)
        self.show_bill_detail_view(bno, customer, total, error_msg="Scan Cancelled by User.")

    def process_verified_deletion(self, bno):
        """Final execution once the QR code is successfully scanned."""
        from database import delete_bill_by_id
        from tkinter import messagebox
        
        # This function (which we updated earlier) adds stock back automatically
        success, msg = delete_bill_by_id(bno)
        
        if success:
            messagebox.showinfo("Verified", f"Success! Bill #{bno} deleted and stock updated.")
            self.show_bills_screen() # Return to the main list
        else:
            messagebox.showerror("Error", f"Database error: {msg}")

    # --- INVENTORY SECTION ---
    def show_inventory_screen(self, billing_mode=False):
        # Reset the temporary bill if we are starting a fresh billing session
        if billing_mode:
            self.temp_bill = {} 

        # Remove the Escape shortcut when entering the main inventory
        self.unbind("<Escape>")
        self.clear_screen()
        
        # --- HEADER AREA ---
        header_area = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header_area.pack(fill="x", padx=50, pady=(40, 10))
        
        title_text = "Select Items for Bill" if billing_mode else "Current Stock Inventory"
        
        ctk.CTkLabel(header_area, 
                     text=title_text, 
                     font=("Segoe UI", 28, "bold"), 
                     text_color=("#1e293b", "white")).pack(side="left")
        
        if billing_mode:
            ctk.CTkButton(header_area, text="Confirm Bill", corner_radius=15, fg_color="#22c55e", 
              text_color="white", font=("Segoe UI", 14, "bold"), height=40, 
              command=self.initiate_checkout).pack(side="right", padx=10)
            
            ctk.CTkButton(header_area, text="Cancel Bill", corner_radius=15, fg_color=ERROR_RED, 
                          text_color="white", font=("Segoe UI", 14, "bold"), height=40, 
                          command=lambda: self.show_inventory_screen(False)).pack(side="right")
        else:
            ctk.CTkButton(header_area, 
                          text="+ Add Product", 
                          fg_color=ACCENT,
                          text_color="white",
                          font=("Segoe UI", 14, "bold"),
                          height=40,
                          corner_radius=15,
                          command=self.show_add_product_screen).pack(side="right")

        # --- SEARCH BAR ---
        search_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        search_frame.pack(fill="x", padx=50, pady=(0, 20))
        
        self.search_entry = ctk.CTkEntry(search_frame, 
                                         placeholder_text="🔍 Search by Product Name or Barcode...", 
                                         width=450, height=40, border_width=1,
                                         border_color=("#334155", "#cbd5e1"), 
                                         fg_color=GLASS_PANEL,
                                         text_color=("#1e293b", "white"),
                                         placeholder_text_color=("#64748b", "#94a3b8"))
        self.search_entry.pack(side="left")
        
        self.search_entry.bind("<KeyRelease>", lambda e: self.refresh_inventory_list(billing_mode, self.search_entry.get()))

        # --- TABLE PANEL ---
        self.table_panel = ctk.CTkFrame(self.main_container, fg_color=GLASS_PANEL, corner_radius=25, 
                                        border_width=1, border_color=("#cbd5e1", "#1e293b"))
        self.table_panel.pack(expand=True, fill="both", padx=40, pady=(0, 40))

        # Header Columns
        t_header = ctk.CTkFrame(self.table_panel, fg_color="transparent", height=50)
        t_header.pack(fill="x", padx=25, pady=(20, 10))
        
        # --- DYNAMIC COLS LOGIC ---
        if billing_mode:
            # We show Stock and a wider column for the +/- buttons
            cols = [("S.no", 60), ("Product Name", 300), ("MRP", 100), ("Stock", 100), ("Select Qty", 200)]
        else:
            cols = [("S.no", 60), ("Product Name", 300), ("Qty", 80), ("DP", 100), ("MRP", 100), ("Status", 150), ("Alerts", 180)]
        
        for text, width in cols:
            anchor = "w" if text == "Product Name" else "center"
            ctk.CTkLabel(t_header, text=text.upper(), width=width, 
                         font=("Segoe UI", 13, "bold"), 
                         text_color=("#475569", "#94a3b8"), 
                         anchor=anchor).pack(side="left", padx=10)

        self.scroll = ctk.CTkScrollableFrame(self.table_panel, fg_color="transparent")
        self.scroll.pack(expand=True, fill="both", padx=10, pady=(0, 20))

        # Initial data load
        self.refresh_inventory_list(billing_mode)

    def show_product_details(self, product_id):
        """Displays the full information for a single product."""
        self.clear_screen()
        
        # 1. Fetch data from DB
        from database import get_product_by_id
        product = get_product_by_id(product_id)

        if not product:
            print("Error: Product data could not be retrieved.")
            return

        # Header with Back Button
        header = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header.pack(fill="x", padx=50, pady=30)
        
        ctk.CTkButton(header, text="← Back to Inventory", width=150, 
                      command=self.show_inventory_screen).pack(side="left")

        # Main Info Card
        card = ctk.CTkFrame(self.main_container, fg_color=GLASS_PANEL, corner_radius=20,
                            border_width=1, border_color=("#cbd5e1", "#334155"))
        card.pack(pady=10, padx=50, fill="both", expand=True)

        # Title Section
        ctk.CTkLabel(card, text=product['name'].upper(), 
                     font=("Segoe UI", 28, "bold"), text_color=ACCENT).pack(pady=(30, 20))

        # Data Grid (Organized in two columns for readability)
        info_container = ctk.CTkFrame(card, fg_color="transparent")
        info_container.pack(fill="both", expand=True, padx=40)

        def create_detail_row(parent, label, value, row_idx, col_idx):
            f = ctk.CTkFrame(parent, fg_color="transparent")
            f.grid(row=row_idx, column=col_idx, sticky="w", padx=20, pady=15)
            ctk.CTkLabel(f, text=f"{label}:", font=("Segoe UI", 12, "bold"), 
                         text_color=("#64748b", "#94a3b8")).pack(anchor="w")
            ctk.CTkLabel(f, text=str(value), font=("Segoe UI", 16), 
                         text_color=("#1e293b", "white")).pack(anchor="w")

        # Column 0
        create_detail_row(info_container, "BARCODE / ID", product['barcode'], 0, 0)
        create_detail_row(info_container, "BATCH NUMBER", product.get('batch', 'N/A'), 1, 0)
        create_detail_row(info_container, "PURCHASE PRICE (DP)", f"₹{product['dp']}", 2, 0)
        create_detail_row(info_container, "SELLING PRICE (MRP)", f"₹{product['mrp']}", 3, 0)

        # Column 1
        create_detail_row(info_container, "QUANTITY", f"{product['qty']} Units", 0, 1)
        create_detail_row(info_container, "MFG DATE", product.get('mfg_date', 'N/A'), 1, 1)
        create_detail_row(info_container, "EXPIRY DATE", product.get('expiry_date', 'N/A'), 2, 1)
        create_detail_row(info_container, "CURRENT STATUS", product['status'], 3, 1)

        # --- UPDATED BUTTONS ---
        btn_row = ctk.CTkFrame(card, fg_color="transparent")
        btn_row.pack(pady=40)
        
        # Edit Button: Passes the full 'product' dict to the edit logic
        ctk.CTkButton(btn_row, text="Edit Product", fg_color="#f59e0b", hover_color="#d97706", 
                      width=150, height=40, font=("Segoe UI", 14, "bold"),
                      command=lambda: self.edit_product_logic(product)).pack(side="left", padx=10)
        
        # Delete Button: Passes the 'id' to the delete logic
        ctk.CTkButton(btn_row, text="Delete Product", fg_color="#ef4444", hover_color="#dc2626", 
                      width=150, height=40, font=("Segoe UI", 14, "bold"),
                      command=lambda: self.delete_product_logic(product['id'])).pack(side="left", padx=10)

        def create_detail_row(parent, label, value, row_idx, col_idx):
            f = ctk.CTkFrame(parent, fg_color="transparent")
            f.grid(row=row_idx, column=col_idx, sticky="w", padx=20, pady=15)
            ctk.CTkLabel(f, text=f"{label}:", font=("Segoe UI", 12, "bold"), 
                         text_color=("#64748b", "#94a3b8")).pack(anchor="w")
            ctk.CTkLabel(f, text=str(value), font=("Segoe UI", 16), 
                         text_color=("#1e293b", "white")).pack(anchor="w")

        # Column 0
        create_detail_row(info_container, "BARCODE / ID", product['barcode'], 0, 0)
        create_detail_row(info_container, "BATCH NUMBER", product.get('batch', 'N/A'), 1, 0)
        create_detail_row(info_container, "PURCHASE PRICE (DP)", f"₹{product['dp']}", 2, 0)
        create_detail_row(info_container, "SELLING PRICE (MRP)", f"₹{product['mrp']}", 3, 0)

        # Column 1
        create_detail_row(info_container, "QUANTITY", f"{product['qty']} Units", 0, 1)
        create_detail_row(info_container, "MFG DATE", product.get('mfg_date', 'N/A'), 1, 1)
        create_detail_row(info_container, "EXPIRY DATE", product.get('expiry_date', 'N/A'), 2, 1)
        create_detail_row(info_container, "CURRENT STATUS", product['status'], 3, 1)

        # Bottom Buttons (Edit/Delete placeholder)
        btn_row = ctk.CTkFrame(card, fg_color="transparent")
        btn_row.pack(pady=40)
        
        ctk.CTkButton(btn_row, text="Edit Product", fg_color="#f59e0b", width=120).pack(side="left", padx=10)
        ctk.CTkButton(btn_row, text="Delete Product", fg_color="#ef4444", width=120).pack(side="left", padx=10)

    def edit_product_logic(self, product):
        """Opens the Add Product screen and fills it with existing data for editing."""
        self.show_add_product_screen()
        
        # Update the Title to indicate we are editing
        # We search for the label we created in show_add_product_screen
        for widget in self.main_container.winfo_children():
            if isinstance(widget, ctk.CTkFrame):
                for child in widget.winfo_children():
                    if isinstance(child, ctk.CTkLabel) and child.cget("text") == "ADD NEW PRODUCT":
                        child.configure(text=f"EDITING: {product['name']}")

        # Pre-fill all the input fields with the current product data
        self.entry_name.insert(0, product['name'])
        self.entry_barcode.insert(0, product['barcode'])
        self.entry_batch.insert(0, product.get('batch', ''))
        self.entry_qty.insert(0, str(product['qty']))
        self.entry_dp.insert(0, str(product['dp']))
        self.entry_mrp.insert(0, str(product['mrp']))
        self.entry_mfg.insert(0, product.get('mfg_date', ''))
        
        if product.get('expiry_date'):
            self.expiry_var.set("Yes")
            self.entry_expiry.configure(state="normal", fg_color=("#ffffff", "#1e293b"))
            self.entry_expiry.insert(0, product['expiry_date'])
            self.check_expiry.select()

        # Change the Save Button to call 'submit_update' instead of 'submit_product'
        for widget in self.main_container.winfo_children():
            if isinstance(widget, ctk.CTkFrame):
                for child in widget.winfo_children():
                    if isinstance(child, ctk.CTkButton) and child.cget("text") == "Confirm & Save Product":
                        child.configure(text="Update Product", 
                                        fg_color="#22c55e",
                                        command=lambda: self.submit_update(product['id']))

    def submit_update(self, product_id):
        """Gathers the edited data and sends it to the database."""
        from database import update_product_in_db
        from tkinter import messagebox
        
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
            messagebox.showinfo("Success", msg)
            self.show_inventory_screen()
        else:
            messagebox.showerror("Error", msg)

    def delete_product_logic(self, product_id):
        """Handles the deletion of a product with a confirmation prompt."""
        from tkinter import messagebox
        from database import delete_product_by_id
        
        if messagebox.askyesno("Confirm Delete", "Are you sure? This cannot be undone."):
            success, msg = delete_product_by_id(product_id)
            if success:
                messagebox.showinfo("Deleted", msg)
                self.show_inventory_screen()
            else:
                messagebox.showerror("Error", msg)

    def refresh_inventory_list(self, billing_mode=False, search_query=""):
        for widget in self.scroll.winfo_children():
            widget.destroy()

        from database import get_all_products
        products = get_all_products(search_query)

        # Initialize the variable dictionary if it doesn't exist
        if not hasattr(self, 'qty_vars'):
            self.qty_vars = {}

        for i, product in enumerate(products, 1):
            p_id = product['id']
            row = ctk.CTkFrame(self.scroll, fg_color="transparent", height=50)
            row.pack(fill="x", padx=15, pady=5)

            # Standard Info
            ctk.CTkLabel(row, text=str(i), width=60).pack(side="left", padx=10)
            
            name_lbl = ctk.CTkLabel(row, text=product['name'], width=300, anchor="w", font=("Segoe UI", 13, "bold"))
            name_lbl.pack(side="left", padx=10)
            
            if not billing_mode:
                name_lbl.configure(cursor="hand2", text_color=ACCENT)
                name_lbl.bind("<Button-1>", lambda e, p_id=p_id: self.show_product_details(p_id))

            if billing_mode:
                # --- BILLING MODE VIEW ---
                ctk.CTkLabel(row, text=f"₹{product['mrp']}", width=100).pack(side="left", padx=10)
                ctk.CTkLabel(row, text=str(product['qty']), width=100).pack(side="left", padx=10)

                # Quantity Selector Container
                qty_cnt = ctk.CTkFrame(row, fg_color="transparent", width=200)
                qty_cnt.pack(side="left", padx=10)

                # Track quantity in a StringVar for the Manual Typer
                # This ensures we can see the current bill amount if already selected
                current_val = self.temp_bill.get(p_id, 0)
                if p_id not in self.qty_vars:
                    self.qty_vars[p_id] = ctk.StringVar(value=str(current_val))
                else:
                    self.qty_vars[p_id].set(str(current_val))

                # - Button
                ctk.CTkButton(qty_cnt, text="-", width=30, height=30, fg_color="#ef4444", font=("Segoe UI", 16, "bold"),
                              command=lambda p=product: self.update_bill_qty(p, -1)).pack(side="left", padx=5)

                # THE MANUAL QTY TYPER (Replaces the Label)
                qty_entry = ctk.CTkEntry(
                    qty_cnt, 
                    textvariable=self.qty_vars[p_id], 
                    width=50, 
                    height=30,
                    justify="center",
                    font=("Segoe UI", 14, "bold"),
                    border_width=1,
                    fg_color=("#ffffff", "#1e293b")
                )
                qty_entry.pack(side="left", padx=2)
                
                # Update temp_bill whenever the user types manually
                self.qty_vars[p_id].trace_add("write", lambda *args, p=product: self.sync_manual_input(p))

                # + Button
                ctk.CTkButton(qty_cnt, text="+", width=30, height=30, fg_color="#22c55e", font=("Segoe UI", 16, "bold"),
                              command=lambda p=product: self.update_bill_qty(p, 1)).pack(side="left", padx=5)
            else:
                # --- STANDARD INVENTORY VIEW ---
                ctk.CTkLabel(row, text=str(product['qty']), width=80).pack(side="left", padx=10)
                ctk.CTkLabel(row, text=f"₹{product['dp']}", width=100).pack(side="left", padx=10)
                ctk.CTkLabel(row, text=f"₹{product['mrp']}", width=100).pack(side="left", padx=10)
                
                status_color = "#22c55e" if product['status'] == "In Stock" else "#ef4444"
                ctk.CTkLabel(row, text=product['status'], width=150, text_color=status_color).pack(side="left", padx=10)
                
                alert_color = "#f59e0b" if product['alerts'] != "—" else ("#475569", "#94a3b8")
                ctk.CTkLabel(row, text=product['alerts'], width=180, text_color=alert_color).pack(side="left", padx=10)

    def sync_manual_input(self, product):
        """Syncs the manual typing directly into the temp_bill dictionary."""
        p_id = product['id']
        try:
            # Get the current text from the entry box
            current_text = self.qty_vars[p_id].get()
            
            if current_text == "":
                val = 0
            else:
                val = int(current_text)
            
            # 1. Prevent negative numbers
            if val < 0: 
                val = 0
                self.qty_vars[p_id].set("0")
            
            # 2. Prevent exceeding stock (Optional but recommended)
            if val > product['qty']:
                val = product['qty']
                self.qty_vars[p_id].set(str(val))
            
            # 3. Update the actual bill dictionary
            self.temp_bill[p_id] = val
            
        except ValueError:
            # If they type letters, we just don't update the bill
            pass

    def update_bill_qty(self, product, delta):
        p_id = product['id']
        # Get current amount from the bill, default to 0
        current = self.temp_bill.get(p_id, 0)
        
        new_val = max(0, current + delta)
        
        # Check stock limit
        if new_val > product['qty']:
            new_val = product['qty']
            
        # Update the dictionary
        self.temp_bill[p_id] = new_val
        
        # Update the Entry Box text via the StringVar
        if p_id in self.qty_vars:
            self.qty_vars[p_id].set(str(new_val))

    def initiate_checkout(self):
        """Step 1: Check if items are selected and ask for Customer Name."""
        # Filter out items with 0 quantity
        items_to_bill = {k: v for k, v in self.temp_bill.items() if v > 0}
        
        if not items_to_bill:
            from tkinter import messagebox
            messagebox.showwarning("Empty Bill", "Please select at least one item to generate a bill.")
            return

        # Simple Popup for Customer Name
        dialog = ctk.CTkInputDialog(text="Enter Customer Name:", title="Checkout")
        customer_name = dialog.get_input()
        
        if customer_name is not None: # If they didn't click 'Cancel'
            self.process_final_bill(customer_name, items_to_bill)

    def process_final_bill(self, customer_name, items_to_bill):
        """Step 2: Calculate total, update DB stock, and save the bill."""
        from database import finalize_bill_in_db
        from tkinter import messagebox

        success, msg = finalize_bill_in_db(customer_name, items_to_bill)
        
        if success:
            messagebox.showinfo("Success", f"Bill Generated for {customer_name}!\n{msg}")
            self.temp_bill = {} # Reset the selection
            self.show_bills_screen() # Go to bill history
        else:
            messagebox.showerror("Error", msg)

    def filter_inventory(self, billing_mode):
        # This gets the current text from the search bar
        query = self.search_entry.get()
        self.refresh_inventory_list(billing_mode, filter_text=query)

    def update_qty(self, name, delta):
        """
        Safely updates the quantity variable for a product.
        Handles both button clicks and manual typing errors.
        """
        try:
            # .get() will throw an error if the box contains non-numeric text
            current_val = self.qty_vars[name].get()
        except (ValueError, Exception):
            # If the input is invalid or empty, reset it to 0
            current_val = 0
            
        # Calculate the new value
        new_val = current_val + delta
        
        # Prevent the quantity from going below zero
        if new_val < 0:
            new_val = 0
            
        # Update the variable (this automatically updates the CTkEntry text)
        self.qty_vars[name].set(new_val)
        
        # Optional: Print to console for debugging
        print(f"Cart updated: {name} is now {new_val}")

    def add_inventory_row(self, sno, name, qty, dp, mrp, status, alerts, billing_mode=False):
        # Everything from here down MUST be indented once (4 spaces)
        row = ctk.CTkFrame(self.scroll, 
                            fg_color=("#dbeafe", "#1e293b"), 
                            height=70, corner_radius=15)
        row.pack(fill="x", pady=5, padx=5)
        row.pack_propagate(False)

        # Basic Info Columns
        ctk.CTkLabel(row, text=sno, width=60).pack(side="left", padx=10)
        ctk.CTkLabel(row, text=name, width=300, anchor="w", 
                     font=("Segoe UI", 14, "bold"),
                     text_color=("#1e293b", "white")).pack(side="left", padx=10)

        if billing_mode:
            # --- DYNAMIC QTY LOGIC (MANUAL TYPER + BUTTONS) ---
            if name not in self.qty_vars:
                self.qty_vars[name] = ctk.IntVar(value=0)

            qty_control = ctk.CTkFrame(row, fg_color="transparent")
            qty_control.pack(side="left", padx=10)
            
            # 1. Minus Button
            ctk.CTkButton(qty_control, text="-", width=30, height=30, corner_radius=8,
                          fg_color=("#ef4444", "#dc2626"), hover_color="#b91c1c",
                          font=("Segoe UI", 16, "bold"),
                          command=lambda: self.update_qty(name, -1)).pack(side="left")
            
            # 2. THE MANUAL TYPER (Entry field)
            qty_typer = ctk.CTkEntry(
                qty_control, 
                textvariable=self.qty_vars[name], 
                width=55, 
                height=32,
                font=("Segoe UI", 14, "bold"),
                justify="center",
                border_width=1,
                fg_color=("#ffffff", "#0f172a"),
                text_color=("#1e293b", "white"),
                border_color=("#cbd5e1", "#334155")
            )
            qty_typer.pack(side="left", padx=8)
            
            # 3. Plus Button
            ctk.CTkButton(qty_control, text="+", width=30, height=30, corner_radius=8,
                          fg_color=("#22c55e", "#16a34a"), text_color="white", hover_color="#15803d",
                          font=("Segoe UI", 16, "bold"),
                          command=lambda: self.update_qty(name, 1)).pack(side="left")
        else:
            # Standard Inventory View
            ctk.CTkLabel(row, text=qty, width=80, font=("Segoe UI", 14, "bold")).pack(side="left", padx=10)

        # Price and Status Columns
        ctk.CTkLabel(row, text=mrp, width=100, font=("Segoe UI", 14, "bold"), text_color="#3b82f6").pack(side="left", padx=10)
        
        s_color = "#f87171" if status == "Expiring" else "#94a3b8"
        ctk.CTkLabel(row, text=status, width=180, text_color=s_color).pack(side="left", padx=10)
        
        a_color = "#fbbf24" if alerts == "Low Stock" else "#94a3b8"
        ctk.CTkLabel(row, text=alerts, width=220, text_color=a_color).pack(side="left", padx=10)

    def show_add_product_screen(self):
        self.clear_screen()
        
        # --- HEADER AREA ---
        header = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header.pack(fill="x", padx=50, pady=30)
        
        ctk.CTkButton(header, text="← Back", width=80, corner_radius=10, 
                      command=self.show_inventory_screen).pack(side="left")
        
        ctk.CTkLabel(header, text="ADD NEW PRODUCT", font=("Segoe UI", 24, "bold"),
                     text_color=("#1e293b", "white")).pack(side="left", padx=20)

        # --- MAIN FORM CARD ---
        form = ctk.CTkFrame(self.main_container, fg_color=GLASS_PANEL, corner_radius=25,
                            border_width=1, border_color=("#cbd5e1", "#334155"))
        form.pack(pady=10, padx=50, fill="both", expand=True)

        # Row 1: Name, Barcode (with Scan Button), Batch No
        row1 = ctk.CTkFrame(form, fg_color="transparent")
        row1.pack(fill="x", padx=40, pady=(20, 0))
        
        self.entry_name = self.create_input(row1, "Product Name")

        # Custom Barcode Section for Scan Button Integration
        barcode_container = ctk.CTkFrame(row1, fg_color="transparent")
        barcode_container.pack(side="left", expand=True, fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(barcode_container, text="Barcode / ID", font=("Segoe UI", 12, "bold"),
                     text_color=("#475569", "#94a3b8")).pack(anchor="w")
        
        barcode_input_row = ctk.CTkFrame(barcode_container, fg_color="transparent")
        barcode_input_row.pack(fill="x", pady=5)
        
        self.entry_barcode = ctk.CTkEntry(barcode_input_row, placeholder_text="Barcode / ID", height=40,
                                          border_color=("#cbd5e1", "#334155"),
                                          fg_color=("#ffffff", "#1e293b"),
                                          text_color=("#1e293b", "white"))
        self.entry_barcode.pack(side="left", expand=True, fill="x")
        
        # Physical Scanner Support: Auto-focus next box on Enter
        self.entry_barcode.bind("<Return>", lambda e: self.entry_batch.focus())
        
        # Webcam Scan Button
        ctk.CTkButton(barcode_input_row, text="📷", width=45, height=40, 
                      fg_color=ACCENT, hover_color="#3b82f6",
                      command=self.open_scan_dialog).pack(side="right", padx=(5, 0))
        
        self.entry_batch = self.create_input(row1, "Batch Number")

        # Row 2: Qty, DP, MRP
        row2 = ctk.CTkFrame(form, fg_color="transparent")
        row2.pack(fill="x", padx=40)
        self.entry_qty = self.create_input(row2, "Quantity", validator=self.validate_numbers)
        self.entry_dp = self.create_input(row2, "Purchase Price (DP)", validator=self.validate_numbers)
        self.entry_mrp = self.create_input(row2, "Selling Price (MRP)", validator=self.validate_numbers)

        # Row 3: Dates (MFG and Expiry)
        date_frame = ctk.CTkFrame(form, fg_color="transparent")
        date_frame.pack(fill="x", padx=40)
        
        self.entry_mfg = self.create_input(date_frame, "MFG Date (DD/MM/YYYY)", validator=self.validate_date)
        self.entry_mfg.bind("<KeyRelease>", self.format_date)
        
        self.entry_expiry = self.create_input(date_frame, "Expiry Date (DD/MM/YYYY)", validator=self.validate_date)
        self.entry_expiry.bind("<KeyRelease>", self.format_date)
        
        # Initial State: Expiry is locked/grayed out
        self.entry_expiry.configure(state="disabled", fg_color=("#cbd5e1", "#334155"))

        # --- EXPIRY CHECKBOX ---
        self.expiry_var = ctk.StringVar(value="No")
        self.check_expiry = ctk.CTkCheckBox(form, text="Does this product expire?", 
                                            variable=self.expiry_var, onvalue="Yes", offvalue="No",
                                            font=("Segoe UI", 13),
                                            command=self.toggle_expiry_field)
        self.check_expiry.pack(pady=10, padx=50, anchor="w")

        # --- SAVE BUTTON ---
        ctk.CTkButton(form, text="Confirm & Save Product", font=("Segoe UI", 16, "bold"), 
                      height=55, fg_color=ACCENT, text_color="white", corner_radius=15,
                      command=self.submit_product).pack(pady=(20, 40), padx=60, fill="x")
        
    def get_available_cameras(self):
        import cv2
        available_cameras = []
        # We try without forcing DSHOW to avoid the backend errors
        for i in range(3):  # Check 0, 1, 2
            cap = cv2.VideoCapture(i) 
            if cap.isOpened():
                # Test if we can actually read a frame
                ret, frame = cap.read()
                if ret:
                    available_cameras.append(f"Camera {i}")
                cap.release()
        return available_cameras if available_cameras else ["No Camera Found"]
        
    def open_scan_dialog(self):
        """Opens the dropdown popup to pick a camera."""
        camera_list = self.get_available_cameras()
        
        # Popup window configuration
        self.cam_window = ctk.CTkToplevel(self)
        self.cam_window.title("Select Scanner")
        self.cam_window.geometry("300x220")
        self.cam_window.attributes("-topmost", True) 
        self.cam_window.grab_set() # Prevents clicking the main window until closed

        ctk.CTkLabel(self.cam_window, text="Select Input Device", 
                     font=("Segoe UI", 14, "bold")).pack(pady=(20, 10))

        self.selected_cam = ctk.StringVar(value=camera_list[0])
        dropdown = ctk.CTkOptionMenu(self.cam_window, values=camera_list, 
                                     variable=self.selected_cam, width=200)
        dropdown.pack(pady=10)

        ctk.CTkButton(self.cam_window, text="Start Scanning", corner_radius=10,
                      command=self.start_webcam_logic).pack(pady=20)
        
    def start_webcam_logic(self):
        """Runs the OpenCV window for the selected camera."""
        import cv2
        from pyzbar import pyzbar
        from pyzbar.pyzbar import ZBarSymbol
        
        try:
            # Parses "Camera 1" into the integer 1
            cam_index = int(self.selected_cam.get().split(" ")[1])
        except (IndexError, ValueError):
            print("No valid camera selected.")
            return

        self.cam_window.destroy() 
        
        cap = cv2.VideoCapture(cam_index)
        window_name = f"Scanning (Cam {cam_index}) - Press 'q' to Quit"

        while True:
            ret, frame = cap.read()
            if not ret: break

            # FIX: Only look for common 1D product barcodes to prevent PDF417 crashes
            barcodes = pyzbar.decode(frame, symbols=[
                ZBarSymbol.EAN13, 
                ZBarSymbol.CODE128, 
                ZBarSymbol.QRCODE, 
                ZBarSymbol.UPCA
            ])
            
            for barcode in barcodes:
                barcode_data = barcode.data.decode("utf-8")
                self.entry_barcode.delete(0, 'end')
                self.entry_barcode.insert(0, barcode_data)
                
                cap.release()
                cv2.destroyAllWindows()
                self.entry_batch.focus()
                return

            cv2.imshow(window_name, frame)
            
            # Exit logic: 'q' key or clicking the 'X' button
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1:
                break

        cap.release()
        cv2.destroyAllWindows()

    def toggle_expiry_field(self):
        """Enable/Disable expiry date field based on checkbox."""
        if self.expiry_var.get() == "Yes":
            # Unlock it and set background to white/navy
            self.entry_expiry.configure(state="normal", 
                                        fg_color=("#ffffff", "#1e293b"),
                                        border_color=ACCENT)
        else:
            # Clear the text and lock it
            self.entry_expiry.delete(0, 'end') 
            self.entry_expiry.configure(state="disabled", 
                                        fg_color=("#cbd5e1", "#334155"), # Grayed out
                                        border_color=("#94a3b8", "#1e293b"))

    def create_input(self, master, placeholder, validator=None):
        frame = ctk.CTkFrame(master, fg_color="transparent")
        frame.pack(side="left", expand=True, fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(frame, text=placeholder, font=("Segoe UI", 12, "bold"),
                     text_color=("#475569", "#94a3b8")).pack(anchor="w")
        
        # Using placeholder_text handles the "text coming back" automatically
        entry = ctk.CTkEntry(frame, placeholder_text=placeholder, height=40, 
                             border_color=("#cbd5e1", "#334155"),
                             fg_color=("#ffffff", "#1e293b"),
                             text_color=("#1e293b", "white"))
        
        if validator:
            # We use 'focusout' or 'key' - 'key' is better for live validation
            vcmd = (self.register(validator), "%P")
            entry.configure(validate="key", validatecommand=vcmd)
            
        entry.pack(fill="x", pady=5)
        return entry
        
    def submit_product(self):
        # Collect ALL the data
        data = {
            "name": self.entry_name.get().strip(),
            "barcode": self.entry_barcode.get().strip(),
            "batch": self.entry_batch.get().strip(),
            "qty": self.entry_qty.get().strip(),
            "dp": self.entry_dp.get().strip(),
            "mrp": self.entry_mrp.get().strip(),
            "mfg": self.entry_mfg.get().strip(),
            "expiry": self.entry_expiry.get() if self.expiry_var.get() == "Yes" else "N/A"
        }

        # --- THE FIX: Remove data["barcode"] from the check below ---
        if not data["name"] or not data["qty"]:
            # I added a print for qty too, as you usually want to know how many you have!
            print("Product Name and Quantity are required!")
            return

        # Send to database
        from database import add_product_to_db
        success, msg = add_product_to_db(data) 
        
        if success:
            self.show_inventory_screen()
        else:
            # If the database returns an error (like a duplicate barcode), show it here
            print(msg)

    # --- NEW: TOGGLE LOGIC ---
    def toggle_expiry_fields(self):
        if self.has_expiry_var.get():
            self.mfg_ent.configure(state="normal", fg_color="#1e293b")
            self.exp_ent.configure(state="normal", fg_color="#1e293b")
        else:
            self.mfg_ent.delete(0, "end") # Clear text if unchecking
            self.exp_ent.delete(0, "end")
            self.mfg_ent.configure(state="disabled", fg_color="#0f172a") # Darker "disabled" look
            self.exp_ent.configure(state="disabled", fg_color="#0f172a")
        

def create_input(self, master, placeholder, validator=None):
    frame = ctk.CTkFrame(master, fg_color="transparent")
    frame.pack(fill="x", padx=40, pady=10)
    
    ctk.CTkLabel(frame, text=placeholder, font=("Segoe UI", 13),
                 text_color=("#1e293b", "#cbd5e1")).pack(anchor="w")
    
    entry = ctk.CTkEntry(frame, placeholder_text=placeholder, height=40, 
                         border_color=("#334155", "#cbd5e1"),
                         fg_color=("#ffffff", "#1e293b"),
                         text_color=("#1e293b", "white"))
    
    if validator:
        # We use self.register because we are now correctly using the class instance
        entry.configure(validate="key", validatecommand=(self.register(validator), "%P"))
        
    entry.pack(fill="x", pady=5)
    return entry
    
    def show_detail_view(self, name):
        self.clear_screen()
        ctk.CTkButton(self.main_container, text="← Back to Inventory", corner_radius=15, 
                      fg_color=ACCENT, text_color="black", font=("Segoe UI", 14, "bold"), height=40,
                      command=self.show_inventory_screen).pack(anchor="w", padx=50, pady=30)

        detail_card = ctk.CTkFrame(self.main_container, fg_color=CARD_BG, corner_radius=30, border_width=1, border_color="#334155")
        detail_card.pack(fill="both", expand=True, padx=50, pady=(0, 50))

        ctk.CTkLabel(detail_card, text=name.upper(), font=("Segoe UI", 42, "bold"), text_color=ACCENT).pack(pady=(50, 10))
        ctk.CTkLabel(detail_card, text="Detailed Batch & Stock Information", font=("Segoe UI", 18, "italic"), text_color="#64748b").pack()

        info_box = ctk.CTkFrame(detail_card, fg_color="#161e2e", corner_radius=20)
        info_box.pack(expand=True, fill="both", padx=40, pady=40)
        ctk.CTkLabel(info_box, text=f"Displaying Batch Tracking for: {name}\n\n(Batch Table coming soon)", 
                     font=("Segoe UI", 16), text_color="#94a3b8").pack(expand=True)

if __name__ == "__main__":
    app = InventoryUI()
    app.mainloop()