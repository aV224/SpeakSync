# main.py -- Main test script for SpeakSync application
# This script is designed to test the backend MongoDB connection and the frontend application launch.
# It should be run from the root directory of the SpeakSync project.
# It assumes the following directory structure:
# SpeakSync/
# ├── backend/
# │   ├── db_connector.py
# ├── frontend/ 
# │   ├── app.py
# ├── main.py (this script)

import sys
import os
import subprocess # To launch the frontend app as a separate process
import time
import logging

import pymongo # Ensure pymongo is installed for MongoDB interaction

# --- Setup Logging ---
# Configure logging for this main script
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [MainTest] - %(message)s')

# # --- Adjust Python Path ---
# # Get the absolute path of the directory containing main.py (SpeakSync/)
project_root = os.path.abspath(os.path.dirname(__file__))
# # Add the project root to sys.path to allow imports from backend and frontend
# sys.path.insert(0, project_root)
# logging.info(f"Project root added to sys.path: {project_root}")

# --- Import Modules ---
# Now we can import from the subdirectories
try:
    from backend import db_connector
    # We don't necessarily need to import the whole app class here
    # unless we want to try and interact with it programmatically (more complex).
    # For launching, subprocess is often easier.
    frontend_app_path = os.path.join(project_root, 'frontend', 'app.py')
    if not os.path.exists(frontend_app_path):
        raise ImportError("frontend/app.py not found.")
except ImportError as e:
    logging.error(f"Failed to import necessary modules: {e}")
    logging.error("Please ensure db_connector.py is in backend/ and app.py is in frontend/")
    sys.exit(1) # Exit if essential modules are missing

# --- Test Data ---
TEST_USERNAME = "test_speaksync_user_123"
TEST_PASSWORD = "test_password!@#" # Use a slightly more complex password
TEST_DIRECTORIES = ["/test/path/alpha", "/test/path/beta"]
TEST_PHONE = "+19995550123"
INCORRECT_PASSWORD = "wrong_password"

# --- Test Functions ---

def test_backend_mongodb():
    """
    Tests the database connection, saving, verification, and cleanup.
    """
    logging.info("--- Starting Backend MongoDB Test ---")
    collection = None # Define collection outside try block for finally clause
    test_passed = True

    try:
        # 1. Test Connection
        logging.info("Attempting to connect to MongoDB...")
        collection = db_connector.get_collection() # connect_db() is called internally if needed
        if collection is None:
             # get_collection now raises ConnectionError on failure,
             # but we add an explicit check for robustness.
             raise ConnectionError("Failed to get MongoDB collection instance.")
        logging.info(f"Successfully connected to DB: '{db_connector.DATABASE_NAME}', Collection: '{db_connector.COLLECTION_NAME}'")
        logging.info("Initial connection successful.")

        # 2. Test Saving Configuration (Upsert)
        logging.info(f"Attempting to save config for test user: {TEST_USERNAME}")
        save_success = db_connector.save_user_config(
            TEST_USERNAME, TEST_PASSWORD, TEST_DIRECTORIES, TEST_PHONE
        )
        if save_success:
            logging.info("Configuration saved successfully (or was already up-to-date).")
        else:
            logging.error("Failed to save configuration via db_connector function.")
            test_passed = False
            # Decide if we should continue testing verification if save failed
            # For this test, let's stop if save fails fundamentally.
            # return False # Or raise an exception

        # Optional: Directly verify data was written (read back from DB)
        logging.info("Directly verifying saved data in MongoDB...")
        # Re-get collection in case connection dropped, though get_collection tries ping
        collection = db_connector.get_collection()
        user_data = collection.find_one({"username": TEST_USERNAME})
        if user_data:
            logging.info(f"Found user data: {user_data}")
            assert user_data["password"] == TEST_PASSWORD, "Password mismatch in DB!" # Security demo only!
            assert user_data["directories"] == TEST_DIRECTORIES, "Directories mismatch in DB!"
            assert user_data["phone_number"] == TEST_PHONE, "Phone number mismatch in DB!"
            logging.info("Direct data verification successful.")
        else:
            logging.error(f"Failed to find the saved user '{TEST_USERNAME}' directly in the database!")
            test_passed = False
            # return False # Stop if data didn't save correctly

        # 3. Test Verification (Correct Credentials)
        logging.info(f"Attempting to verify user '{TEST_USERNAME}' with CORRECT password...")
        verify_correct = db_connector.verify_user(TEST_USERNAME, TEST_PASSWORD)
        if verify_correct:
            logging.info("User verification successful (Correct Password).")
        else:
            logging.error("User verification FAILED with correct password!")
            test_passed = False

        # 4. Test Verification (Incorrect Credentials)
        logging.info(f"Attempting to verify user '{TEST_USERNAME}' with INCORRECT password...")
        verify_incorrect = db_connector.verify_user(TEST_USERNAME, INCORRECT_PASSWORD)
        if not verify_incorrect:
            logging.info("User verification correctly failed (Incorrect Password).")
        else:
            logging.error("User verification SUCCEEDED with incorrect password!")
            test_passed = False

    except (ValueError, ConnectionError, RuntimeError, pymongo.errors.PyMongoError) as e:
        logging.error(f"An error occurred during MongoDB test: {e}", exc_info=True) # Log traceback
        test_passed = False
    except AssertionError as ae:
         logging.error(f"Data validation assertion failed: {ae}")
         test_passed = False
    finally:
        # 5. Cleanup - VERY IMPORTANT for tests
        logging.info("--- Starting Cleanup ---")
        if collection is not None:
            try:
                logging.info(f"Attempting to delete test user: {TEST_USERNAME}")
                delete_result = collection.delete_one({"username": TEST_USERNAME})
                if delete_result.deleted_count > 0:
                    logging.info(f"Successfully deleted test user '{TEST_USERNAME}'. Count: {delete_result.deleted_count}")
                else:
                    logging.warning(f"Could not find test user '{TEST_USERNAME}' to delete (maybe save failed earlier?).")
            except pymongo.errors.PyMongoError as e:
                logging.error(f"Error deleting test user '{TEST_USERNAME}': {e}")
                test_passed = False # Consider cleanup failure a test failure
        else:
             logging.warning("Collection object was None, skipping direct cleanup.")

        # Close the overall connection used by the module
        db_connector.close_db_connection()
        logging.info("Database connection closed.")
        logging.info(f"--- Backend MongoDB Test Finished (Passed: {test_passed}) ---")
        return test_passed

def test_frontend_launch():
    """
    Launches the frontend application using subprocess, captures its output,
    and explicitly sets the working directory.
    """
    logging.info("--- Starting Frontend Launch Test ---")
    logging.info(f"Attempting to launch frontend app: {frontend_app_path}")
    process = None
    # Ensure project_root is defined (it should be from the top of main.py)
    if 'project_root' not in globals() or not project_root:
         logging.error("Project root directory not defined. Cannot set cwd.")
         return False

    logging.info(f"Setting subprocess cwd to: {project_root}")

    try:
        # Launch app.py using the python interpreter
        # Capture stdout and stderr, set cwd
        process = subprocess.Popen(
            [sys.executable, frontend_app_path],
            stdout=subprocess.PIPE,      # Capture standard output
            stderr=subprocess.PIPE,      # Capture standard error
            text=True,                   # Decode output as text (requires Python 3.7+)
            encoding='utf-8',            # Specify encoding for safety
            cwd=project_root             # Set child's working directory to project root
        )
        logging.info(f"Frontend application process starting (PID: {process.pid}). Waiting for it to finish or timeout...")

        # Wait for the process to complete and get output
        try:
            # Set a reasonable timeout (e.g., 30 seconds). If the GUI opens
            # correctly, it will likely run longer, causing a TimeoutExpired,
            # which is okay for just checking *launch*. If it crashes fast,
            # communicate() will return quickly.
            stdout, stderr = process.communicate(timeout=30)
            logging.info(f"Frontend process finished with return code: {process.returncode}")

        except subprocess.TimeoutExpired:
            # --- This is now the EXPECTED outcome if the GUI launched successfully ---
            logging.info(f"Frontend process (PID: {process.pid}) timed out, indicating GUI likely opened successfully and is running.")
            process.kill()  # Terminate the GUI process as the test launch succeeded
            stdout, stderr = process.communicate() # Get any final output
            logging.info("Killed frontend process after timeout (expected for successful GUI launch).")
            # --- Treat timeout as success for this specific test ---
            if stdout: logging.info(f"Frontend stdout (before kill):\n{stdout.strip()}")
            if stderr: logging.warning(f"Frontend stderr (before kill):\n{stderr.strip()}") # Log stderr as warning
            return True # Timeout implies successful launch in this context

        except Exception as comm_err:
            logging.error(f"Error communicating with frontend process: {comm_err}")
            if process.poll() is None: # Check if process is still running
                process.kill()
            return False # Communication error is a test failure

        # --- If communicate() finished WITHOUT timeout ---
        # This means the app exited quickly (likely crashed or finished unexpectedly)
        logging.warning(f"Frontend process exited quickly (return code: {process.returncode}).")
        test_passed = True # Assume pass unless errors found

        if stdout:
            logging.info("--- Frontend stdout: ---")
            logging.info(stdout.strip())
            logging.info("------------------------")
        if stderr:
            logging.error("--- Frontend stderr: ---")
            logging.error(stderr.strip()) # Treat any stderr output as an error sign
            logging.error("------------------------")
            test_passed = False # Error output means failure
        if process.returncode != 0:
             logging.error(f"Frontend process exited with non-zero code: {process.returncode}")
             test_passed = False # Non-zero exit code means failure

        return test_passed


    except FileNotFoundError:
        logging.error(f"Error: Could not find Python executable '{sys.executable}' or app script '{frontend_app_path}'.")
        return False
    except Exception as e:
        logging.error(f"An error occurred launching the frontend application: {e}", exc_info=True)
        if process and process.poll() is None:
            process.kill() # Ensure process is killed on error
        return False
    finally:
        logging.info("--- Frontend Launch Test Finished ---")




# --- Main Execution ---
if __name__ == "__main__":
    logging.info("===== Starting SpeakSync Tests =====")

    # Run Backend Test
    backend_result = test_backend_mongodb()
    print("-" * 50) # Separator in console

    # Run Frontend Test
    frontend_result = test_frontend_launch()
    print("-" * 50)

    logging.info("===== SpeakSync Tests Completed =====")
    logging.info(f"Backend Test Result: {'PASS' if backend_result else 'FAIL'}")
    logging.info(f"Frontend Launch Result: {'SUCCESS' if frontend_result else 'FAIL'}")

    if not backend_result:
        sys.exit(1) # Exit with error code if backend tests failed