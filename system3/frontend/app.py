# input_file_0.py (app.py)
import sys
import os

# --- Add project root to sys.path ---
frontend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(frontend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)
# --- End of path modification ---

try:
    from backend import db_connector as db
    # Import status constants for clarity
    from backend.db_connector import (
        AUTH_SUCCESS, AUTH_USER_NOT_FOUND, AUTH_INVALID_PASSWORD, AUTH_DB_ERROR,
        CREATE_SUCCESS, CREATE_USER_EXISTS, CREATE_DB_ERROR
    )
except ImportError as e:
     print(f"FATAL ERROR: Could not import 'backend.db_connector'. Check structure and path.")
     print(f"Project Root added to sys.path: {project_root}")
     print(f"Current sys.path: {sys.path}")
     sys.exit(1)


import tkinter as tk
from tkinter import ttk # Themed Tkinter widgets
from tkinter import messagebox
from tkinter import font as tkFont # For custom fonts
import logging

# Configure logging (use root logger or specific one)
app_logger = logging.getLogger("SpeakSyncApp")
app_logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
if not app_logger.hasHandlers():
    app_logger.addHandler(handler)

# --- Constants and Styling (Keep existing) ---
APP_NAME = "SpeakSync"
# Color Palette: Black and Navy Blue scheme
COLOR_PRIMARY_BG = "#0B132B"        # Very dark navy background
COLOR_SECONDARY_BG = "#1C2541"      # Slightly lighter navy for entries/buttons
COLOR_TERTIARY_BG = "#3A506B"       # Muted blue-grey for accents/hover
COLOR_ACCENT = "#5BC0BE"            # Contrasting teal/cyan accent (can adjust)
COLOR_FG = "#E0E0E0"                 # Light grey text (off-white)
COLOR_FG_DIM = "#A4B8C4"             # Dimmer text for less important labels (optional)
COLOR_ENTRY_BORDER = "#3A506B"       # Border color for entries
COLOR_ENTRY_FOCUS_BORDER = COLOR_ACCENT # Highlight border on focus

FONT_FAMILY_MAIN = "Segoe UI"       # Primary font
FONT_FAMILY_TITLE = "Segoe UI Semibold" # Font for the main app title

# --- Main Application Class ---
class SpeakSyncApp(tk.Tk): # Renamed class slightly
    def __init__(self, *args, **kwargs):
        tk.Tk.__init__(self, *args, **kwargs)

        self.title(f"{APP_NAME} - Configuration") # Window title bar
        self.geometry("600x600") # Slightly larger for better spacing
        self.configure(bg=COLOR_PRIMARY_BG) # Set main window background

        # --- Font Configuration (Keep existing) ---
        self.default_font = tkFont.nametofont("TkDefaultFont")
        self.default_font.configure(family=FONT_FAMILY_MAIN, size=10)
        self.option_add("*Font", self.default_font)

        self.title_font = tkFont.Font(family=FONT_FAMILY_TITLE, size=24, weight="bold")
        self.header_font = tkFont.Font(family=FONT_FAMILY_MAIN, size=16, weight="bold")
        self.label_font = tkFont.Font(family=FONT_FAMILY_MAIN, size=11)
        self.button_font = tkFont.Font(family=FONT_FAMILY_MAIN, size=11)
        self.entry_font = tkFont.Font(family=FONT_FAMILY_MAIN, size=11)

        # --- Style Configuration (ttk) (Keep existing) ---
        style = ttk.Style(self)
        try:
            style.theme_use('clam')
        except tk.TclError:
            app_logger.warning("Clam theme not available, using default.")

        # Configure custom styles based on our color palette (Keep existing)
        style.configure("TFrame", background=COLOR_PRIMARY_BG)
        style.configure("TLabel", background=COLOR_PRIMARY_BG, foreground=COLOR_FG, font=self.label_font, padding=5)
        style.configure("Header.TLabel", foreground=COLOR_FG, font=self.header_font, padding=(5, 10))
        style.configure("Dim.TLabel", foreground=COLOR_FG_DIM, font=self.label_font)
        style.configure("TButton", background=COLOR_SECONDARY_BG, foreground=COLOR_FG, font=self.button_font, padding=(12, 8), relief="flat", borderwidth=0)
        style.map("TButton", background=[('active', COLOR_TERTIARY_BG), ('!disabled', COLOR_SECONDARY_BG)], foreground=[('active', COLOR_FG)])
        style.configure("TEntry", fieldbackground=COLOR_SECONDARY_BG, foreground=COLOR_FG, insertcolor=COLOR_FG, font=self.entry_font, borderwidth=1, relief="solid", bordercolor=COLOR_ENTRY_BORDER)
        style.map("TEntry", bordercolor=[('focus', COLOR_ENTRY_FOCUS_BORDER)], fieldbackground=[('disabled', '#555')])
        # Add style for smaller link-like buttons (optional)
        style.configure("Link.TButton", padding=2, relief="flat", borderwidth=0, background=COLOR_PRIMARY_BG, foreground=COLOR_ACCENT)
        style.map("Link.TButton", foreground=[('active', COLOR_FG)])

        # --- Application Title (Keep existing) ---
        title_frame = tk.Frame(self, bg=COLOR_PRIMARY_BG)
        title_frame.pack(side="top", fill="x", pady=(15, 5))
        app_title_label = tk.Label(title_frame, text=APP_NAME, font=self.title_font, bg=COLOR_PRIMARY_BG, fg=COLOR_ACCENT)
        app_title_label.pack(pady=5)
        separator = ttk.Separator(self, orient='horizontal')
        separator.pack(side="top", fill='x', padx=20, pady=(0, 15))


        # --- Container for Pages ---
        container = ttk.Frame(self, padding=(30, 15)) # Main content padding
        container.pack(side="top", fill="both", expand=True)
        container.grid_rowconfigure(0, weight=1)
        container.grid_columnconfigure(0, weight=1)

        self.frames = {}
        # Keep storing user data temporarily after successful login for ConfigPage
        self.current_user_data = {"username": None, "password": None}

        # Initialize pages (Frames) - ADD CreateAccountPage
        for F in (LoginPage, CreateAccountPage, ConfigPage, SuccessPage): # Added CreateAccountPage
            page_name = F.__name__
            frame = F(parent=container, controller=self)
            self.frames[page_name] = frame
            frame.grid(row=0, column=0, sticky="nsew")

        self.show_frame("LoginPage") # Start with Login Page

        self.protocol("WM_DELETE_WINDOW", self.on_closing)


    def show_frame(self, page_name):
        '''Show a frame for the given page name'''
        frame = self.frames[page_name]
        # Clear password field when switching to Login or Create Account
        if page_name in ["LoginPage", "CreateAccountPage"]:
             if hasattr(frame, 'pass_entry'):
                  frame.pass_entry.delete(0, tk.END)
             if hasattr(frame, 'user_entry') and frame.user_entry.get(): # Optionally focus user if filled
                  frame.pass_entry.focus_set()
             elif hasattr(frame, 'user_entry'): # Otherwise focus user entry
                  frame.user_entry.focus_set()


        frame.tkraise()
        app_logger.info(f"Showing frame: {page_name}")
        # Check remains valid: Config page requires login first
        if page_name == "ConfigPage" and not self.current_user_data.get("username"):
             messagebox.showerror("Error", "User data not available. Please log in again.")
             self.show_frame("LoginPage")

    def store_credentials_temp(self, username, password):
        """Stores credentials temporarily after successful login."""
        # !! SECURITY WARNING: Storing password temporarily in memory is not ideal !!
        app_logger.warning("SECURITY ALERT: Storing password temporarily in controller memory.")
        self.current_user_data["username"] = username
        self.current_user_data["password"] = password
        app_logger.info(f"Stored credentials temporarily for user: {username}")

    def get_stored_credentials(self):
        """Retrieves the temporarily stored user credentials."""
        return self.current_user_data

    def on_closing(self):
        """Handles window closing event."""
        app_logger.info("Application closing...")
        db.close_db_connection()
        self.destroy()

# --- Page Classes (Frames) ---

class LoginPage(ttk.Frame):
    def __init__(self, parent, controller):
        ttk.Frame.__init__(self, parent, style="TFrame")
        self.controller = controller

        # --- Widgets ---
        header = ttk.Label(self, text="User Login", style="Header.TLabel")
        header.pack(pady=(20, 30))

        user_label = ttk.Label(self, text="Username:")
        user_label.pack(pady=(5, 2), padx=50, anchor='w')
        self.user_entry = ttk.Entry(self, width=40, font=controller.entry_font)
        self.user_entry.pack(pady=(0, 10), padx=50, fill='x')

        pass_label = ttk.Label(self, text="Password:")
        pass_label.pack(pady=(5, 2), padx=50, anchor='w')
        self.pass_entry = ttk.Entry(self, show="*", width=40, font=controller.entry_font)
        self.pass_entry.pack(pady=(0, 25), padx=50, fill='x')

        login_button = ttk.Button(self, text="Login", command=self.attempt_login, style="TButton")
        login_button.pack(pady=5) # Reduced padding

        # Button to navigate to Create Account page
        create_acc_button = ttk.Button(
            self, text="Need an account? Create one",
            command=lambda: controller.show_frame("CreateAccountPage"),
            style="Link.TButton" # Use link-like style
        )
        create_acc_button.pack(pady=(5, 15))

        # Bind Enter key
        self.user_entry.bind("<Return>", lambda event: self.pass_entry.focus())
        self.pass_entry.bind("<Return>", lambda event: self.attempt_login())

        # Focus on first entry on page load
        self.user_entry.focus_set()


    def attempt_login(self):
        username = self.user_entry.get().strip()
        password = self.pass_entry.get() # Don't strip password

        if not username or not password:
            messagebox.showwarning("Input Error", "Please enter both username and password.", parent=self)
            return

        app_logger.info(f"Attempting login for user: {username}")
        try:
            # Show busy cursor
            self.config(cursor="watch")
            self.update_idletasks()

            # Call the verification function from db_connector
            auth_status = db.verify_user(username, password)

            self.config(cursor="") # Restore cursor

            # Process the authentication status
            if auth_status == AUTH_SUCCESS:
                app_logger.info(f"Login successful for user: {username}")
                messagebox.showinfo("Login Successful", f"Welcome back, {username}!", parent=self)
                # Store credentials temporarily for ConfigPage
                self.controller.store_credentials_temp(username, password)
                # Clear login fields before switching
                self.user_entry.delete(0, tk.END)
                # self.pass_entry.delete(0, tk.END) # Keep password field deletion in show_frame
                self.controller.show_frame("ConfigPage")
            elif auth_status == AUTH_USER_NOT_FOUND:
                app_logger.warning(f"Login failed: User '{username}' not found.")
                messagebox.showerror("Login Failed", "Username not found. Please check the username or create an account.", parent=self)
            elif auth_status == AUTH_INVALID_PASSWORD:
                app_logger.warning(f"Login failed: Invalid password for user '{username}'.")
                messagebox.showerror("Login Failed", "Incorrect password.", parent=self)
                # Clear only password field on failure
                self.pass_entry.delete(0, tk.END)
                self.pass_entry.focus_set() # Focus password field again
            elif auth_status == AUTH_DB_ERROR:
                 app_logger.error("Login failed due to database error during verification.")
                 messagebox.showerror("Login Error", "Could not verify credentials due to a database error. Please try again later.", parent=self)
            else:
                 # Should not happen if verify_user returns defined constants
                 app_logger.error(f"Login attempt returned unexpected status: {auth_status}")
                 messagebox.showerror("Login Error", "An unexpected error occurred during login.", parent=self)

        except Exception as e:
            # Catch any other unexpected error during the login process itself
            self.config(cursor="") # Restore cursor
            app_logger.exception("An unexpected error occurred during login attempt.")
            messagebox.showerror("Error", f"An unexpected error occurred: {e}", parent=self)


class CreateAccountPage(ttk.Frame):
    def __init__(self, parent, controller):
        ttk.Frame.__init__(self, parent, style="TFrame")
        self.controller = controller

        # --- Widgets ---
        header = ttk.Label(self, text="Create New Account", style="Header.TLabel")
        header.pack(pady=(20, 30))

        user_label = ttk.Label(self, text="Choose Username:")
        user_label.pack(pady=(5, 2), padx=50, anchor='w')
        self.user_entry = ttk.Entry(self, width=40, font=controller.entry_font)
        self.user_entry.pack(pady=(0, 10), padx=50, fill='x')

        pass_label = ttk.Label(self, text="Choose Password:")
        pass_label.pack(pady=(5, 2), padx=50, anchor='w')
        self.pass_entry = ttk.Entry(self, show="*", width=40, font=controller.entry_font)
        self.pass_entry.pack(pady=(0, 25), padx=50, fill='x')

        # Add password confirmation later if desired

        create_button = ttk.Button(self, text="Create Account", command=self.submit_creation, style="TButton")
        create_button.pack(pady=5)

        # Button to navigate back to Login page
        back_button = ttk.Button(
            self, text="Already have an account? Login",
            command=lambda: controller.show_frame("LoginPage"),
            style="Link.TButton"
        )
        back_button.pack(pady=(5, 15))

        # Bind Enter key
        self.user_entry.bind("<Return>", lambda event: self.pass_entry.focus())
        self.pass_entry.bind("<Return>", lambda event: self.submit_creation())

        self.user_entry.focus_set()

    def submit_creation(self):
        username = self.user_entry.get().strip()
        password = self.pass_entry.get() # Don't strip password

        # Basic Validation
        if not username or not password:
            messagebox.showwarning("Input Error", "Please enter both username and password.", parent=self)
            return
        if len(password) < 6: # Example: Basic password length check
             messagebox.showwarning("Input Error", "Password must be at least 6 characters long.", parent=self)
             return

        # Add password confirmation check here if confirmation field exists

        app_logger.info(f"Attempting to create account for user: {username}")
        try:
            self.config(cursor="watch")
            self.update_idletasks()

            creation_status = db.create_user(username, password)

            self.config(cursor="")

            # Process creation status
            if creation_status == CREATE_SUCCESS:
                app_logger.info(f"Account created successfully for user: {username}")
                messagebox.showinfo("Account Created", "Account created successfully! You can now log in.", parent=self)
                # Clear fields after success
                self.user_entry.delete(0, tk.END)
                # self.pass_entry.delete(0, tk.END) # Keep password clearing in show_frame
                # Navigate to login page
                self.controller.show_frame("LoginPage")
            elif creation_status == CREATE_USER_EXISTS:
                app_logger.warning(f"Account creation failed: Username '{username}' already exists.")
                messagebox.showerror("Creation Failed", "Username already taken. Please choose a different username.", parent=self)
                self.user_entry.focus_set() # Focus username field again
            elif creation_status == CREATE_DB_ERROR:
                 app_logger.error("Account creation failed due to database error.")
                 messagebox.showerror("Creation Error", "Could not create account due to a database error. Please try again later.", parent=self)
            else:
                 app_logger.error(f"Account creation attempt returned unexpected status: {creation_status}")
                 messagebox.showerror("Creation Error", "An unexpected error occurred during account creation.", parent=self)

        except Exception as e:
            self.config(cursor="")
            app_logger.exception("An unexpected error occurred during account creation submission.")
            messagebox.showerror("Error", f"An unexpected error occurred: {e}", parent=self)


class ConfigPage(ttk.Frame): # No changes needed here for login logic itself
    def __init__(self, parent, controller):
        ttk.Frame.__init__(self, parent, style="TFrame")
        self.controller = controller

        # --- Widgets ---
        header = ttk.Label(self, text="Configure Access", style="Header.TLabel")
        header.pack(pady=(10, 20))

        dir_label = ttk.Label(self, text="Accessible Directories (one per line):")
        dir_label.pack(pady=(5, 2), padx=20, anchor='w')
        self.dir_text = tk.Text(self, height=10, width=60, bg=COLOR_SECONDARY_BG, fg=COLOR_FG, insertbackground=COLOR_FG, relief="solid", borderwidth=1, font=controller.entry_font, wrap="word")
        self.dir_text.configure(highlightbackground=COLOR_ENTRY_BORDER, highlightcolor=COLOR_ENTRY_FOCUS_BORDER, highlightthickness=1)
        self.dir_text.pack(pady=(0, 15), padx=20, fill="x", expand=False)

        phone_label = ttk.Label(self, text="Phone Number for Voice Commands:")
        phone_label.pack(pady=(5, 2), padx=20, anchor='w')
        self.phone_entry = ttk.Entry(self, width=40, font=controller.entry_font)
        self.phone_entry.pack(pady=(0, 25), padx=20, anchor='w')

        button_frame = ttk.Frame(self)
        button_frame.pack(pady=10, fill='x', padx=20)

        submit_button = ttk.Button(button_frame, text="Submit Configuration", command=self.submit_config)
        submit_button.pack(side=tk.LEFT, padx=(0, 10))

        # Changed 'Back to Login' to 'Logout' - more appropriate context
        logout_button = ttk.Button(button_frame, text="Logout", command=self.logout)
        logout_button.pack(side=tk.LEFT)

    def logout(self):
        """Logs the user out by clearing temp credentials and returning to Login page."""
        app_logger.info(f"Logging out user: {self.controller.get_stored_credentials().get('username')}")
        # Clear stored credentials
        self.controller.current_user_data = {"username": None, "password": None}
        # Clear fields on config page (optional)
        self.dir_text.delete("1.0", tk.END)
        self.phone_entry.delete(0, tk.END)
        # Go back to login page
        self.controller.show_frame("LoginPage")

    def submit_config(self):
        directories_str = self.dir_text.get("1.0", tk.END).strip()
        directories_list = [line.strip() for line in directories_str.split('\n') if line.strip()]
        phone_number = self.phone_entry.get().strip()

        # Retrieve temporarily stored credentials after successful login
        user_data = self.controller.get_stored_credentials()
        username = user_data.get("username")
        password = user_data.get("password") # Retrieve stored password

        # Validation
        if not username or not password: # Check if login state is valid
             messagebox.showerror("Error", "User session data missing. Please log out and log in again.", parent=self)
             self.logout() # Force logout if state is invalid
             return
        if not directories_list:
            messagebox.showwarning("Input Error", "Please enter at least one directory path.", parent=self)
            return
        if not phone_number:
            messagebox.showwarning("Input Error", "Please enter the phone number.", parent=self)
            return

        # Try to save configuration
        try:
            app_logger.info(f"Attempting to save config for user: {username}")
            self.config(cursor="watch")
            self.update_idletasks()

            # Call save_user_config, passing the retrieved username and password
            success = db.save_user_config(username, password, directories_list, phone_number)

            self.config(cursor="")

            if success:
                messagebox.showinfo("Success", "Configuration saved successfully!", parent=self)
                # Don't clear fields automatically, user might want to see them
                # Go to success page
                self.controller.show_frame("SuccessPage")
            else:
                # This 'else' case in save_user_config means matched but no modification
                # or matched_count was 0 (which shouldn't happen here)
                messagebox.showwarning("Notice", "Configuration processed, but no changes were saved (data might be identical or an issue occurred - check logs).", parent=self)

        except (ValueError, ConnectionError, RuntimeError) as e:
            self.config(cursor="")
            app_logger.error(f"Failed to save configuration: {e}")
            # Display error message from exception
            messagebox.showerror("Save Error", f"Failed to save configuration:\n{e}", parent=self)
        except Exception as e:
            self.config(cursor="")
            app_logger.exception("An unexpected error occurred during submission.")
            messagebox.showerror("Error", f"An unexpected error occurred: {e}", parent=self)


class SuccessPage(ttk.Frame): # No changes needed here
    def __init__(self, parent, controller):
        ttk.Frame.__init__(self, parent, style="TFrame")
        self.controller = controller

        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(4, weight=1)
        self.grid_columnconfigure(0, weight=1)

        header = ttk.Label(self, text="Submission Successful!", style="Header.TLabel")
        header.grid(row=1, column=0, pady=(40, 10))

        message = ttk.Label(self, text=f"Your {APP_NAME} configuration has been saved.\nThank you!", justify=tk.CENTER, font=controller.label_font)
        message.grid(row=2, column=0, pady=10)

        button_frame = ttk.Frame(self)
        button_frame.grid(row=3, column=0, pady=(30, 10))

        # Changed button to go back to Config page to allow further edits
        config_again_button = ttk.Button(button_frame, text="Back to Configuration",
                                         command=lambda: controller.show_frame("ConfigPage"))
        config_again_button.pack(side=tk.LEFT, padx=5)

        exit_button = ttk.Button(button_frame, text="Exit Application", command=controller.on_closing)
        exit_button.pack(side=tk.LEFT, padx=5)


# --- Run the Application ---
if __name__ == "__main__":
    # Add basic check for .env file existence
    if not os.path.exists(os.path.join(project_root, ".env")):
         print("CRITICAL ERROR: .env file not found in project root. Please create it with MONGO_URI.")
         # Show a simple Tkinter error box even without full app init
         root = tk.Tk()
         root.withdraw()
         messagebox.showerror("Configuration Error", ".env file not found.\nPlease create it with your MONGO_URI.")
         root.destroy()
         sys.exit(1)

    # Initial DB connection attempt wrapped in try/except
    try:
        # Attempt initial DB connection early to catch config errors
        # connect_db() now returns collection or raises error
        initial_collection = db.connect_db()
        if not initial_collection:
            # This case should be covered by connect_db raising error, but belts and suspenders
            raise ConnectionError("Initial database connection failed silently (returned None).")
        app_logger.info("Initial database connection successful.")

        app = SpeakSyncApp() # Use the updated class name
        app.mainloop()

    except (ValueError, ConnectionError, RuntimeError) as e:
         app_logger.critical(f"Application startup failed: {e}")
         # Use a basic Tkinter message box for startup errors
         root = tk.Tk()
         root.withdraw()
         messagebox.showerror("Startup Error", f"Failed to initialize {APP_NAME}:\n{e}\nPlease check your .env configuration and MongoDB connection.")
         root.destroy()
         sys.exit(1) # Exit if startup fails critically
    except Exception as e:
         app_logger.critical(f"An unexpected critical error occurred on startup: {e}", exc_info=True)
         root = tk.Tk()
         root.withdraw()
         messagebox.showerror("Critical Error", f"An unexpected error occurred during {APP_NAME} startup:\n{e}")
         root.destroy()
         sys.exit(1) # Exit on critical unexpected errors