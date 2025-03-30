# main.py
import sys
import os
import subprocess
import logging

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [MainLauncher] - %(message)s')

# --- Get Project Paths ---
# Absolute path to the directory containing main.py (SpeakSync/)
project_root = os.path.dirname(os.path.abspath(__file__))
# Construct the absolute path to the frontend app script
frontend_app_path = os.path.join(project_root, 'frontend', 'app.py')

# --- Main Execution Block ---
if __name__ == "__main__":
    logging.info(f"SpeakSync Root Directory: {project_root}")
    logging.info(f"Attempting to launch GUI application: {frontend_app_path}")

    # Check if the frontend script exists before attempting to run
    if not os.path.exists(frontend_app_path):
        logging.error(f"Frontend application script not found at: {frontend_app_path}")
        sys.exit(1) # Exit if the script is missing

    try:
        # Launch app.py using the same Python interpreter that is running main.py
        # Set the working directory (cwd) to the project root. This helps libraries
        # like python-dotenv find the .env file correctly and ensures consistency.
        # The process is started and this script (main.py) will not wait for it.
        process = subprocess.Popen(
            [sys.executable, frontend_app_path],
            cwd=project_root,
            # Let the subprocess inherit stdout/stderr from this script's environment
            # No need to capture PIPE if we just want it to run independently
        )
        logging.info(f"Successfully launched SpeakSync GUI process (PID: {process.pid}).")
        logging.info("The main launcher script will now exit, but the GUI should remain running.")

    except FileNotFoundError:
        # This error occurs if sys.executable or frontend_app_path is incorrect
        logging.error(f"Error: Could not find Python executable '{sys.executable}' or the application script '{frontend_app_path}'.")
        sys.exit(1)
    except Exception as e:
        # Catch any other potential errors during process launch
        logging.error(f"An unexpected error occurred while launching the GUI application:", exc_info=True)
        sys.exit(1)

    # This main.py script exits here, but the GUI process launched via Popen continues.