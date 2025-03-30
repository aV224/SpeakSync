# input_file_1.py (db_connector.py)
import os
import pymongo
from dotenv import load_dotenv
import logging
import datetime # Explicitly import datetime for timestamp

# Configure logging
# Use a more specific logger name if desired
db_logger = logging.getLogger("DBConnector")
db_logger.setLevel(logging.INFO)
handler = logging.StreamHandler() # Output to console
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
if not db_logger.hasHandlers(): # Avoid adding multiple handlers if reloaded
    db_logger.addHandler(handler)


# Load environment variables from .env file
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = "speaksync_assistant_config" # Updated DB name slightly
COLLECTION_NAME = "user_settings"

# --- Database Connection ---
_db_client = None
_db = None
_collection = None

# Constants for Verification Results
AUTH_SUCCESS = "SUCCESS"
AUTH_USER_NOT_FOUND = "USER_NOT_FOUND"
AUTH_INVALID_PASSWORD = "INVALID_PASSWORD"
AUTH_DB_ERROR = "DB_ERROR"

# Constants for Creation Results
CREATE_SUCCESS = "SUCCESS"
CREATE_USER_EXISTS = "USER_EXISTS"
CREATE_DB_ERROR = "DB_ERROR"


def connect_db():
    """Establishes connection to the MongoDB database and collection."""
    global _db_client, _db, _collection
    # No need to reconnect if already connected and client is valid
    if _db_client is not None and _collection is not None:
        try:
             # Quick ping to check health before returning existing connection
             _db_client.admin.command('ping')
             return _collection
        except Exception:
             db_logger.warning("Ping failed, forcing reconnect.")
             close_db_connection() # Close existing potentially broken connection

    # Proceed with connection if client is None or ping failed
    if not MONGO_URI:
        db_logger.error("MongoDB URI not found. Please set MONGO_URI in your .env file.")
        raise ValueError("MongoDB URI not configured.")
    try:
        db_logger.info("Attempting to connect to MongoDB...")
        _db_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        _db_client.admin.command('ismaster') # Check connectivity
        _db = _db_client[DATABASE_NAME]
        _collection = _db[COLLECTION_NAME]
        db_logger.info(f"Successfully connected to MongoDB. Database: {DATABASE_NAME}, Collection: {COLLECTION_NAME}")
        return _collection
    except pymongo.errors.ServerSelectionTimeoutError as err:
        db_logger.error(f"MongoDB connection timed out: {err}")
        close_db_connection() # Ensure cleanup on failure
        raise ConnectionError(f"Failed to connect to MongoDB (Timeout): {err}")
    except pymongo.errors.ConnectionFailure as err:
        db_logger.error(f"MongoDB connection failed: {err}")
        close_db_connection()
        raise ConnectionError(f"Failed to connect to MongoDB (Connection Failure): {err}")
    except Exception as e:
        db_logger.error(f"An unexpected error occurred during DB connection: {e}", exc_info=True)
        close_db_connection()
        # Include original error type in message for clarity
        raise ConnectionError(f"An unexpected error ({type(e).__name__}) occurred during DB setup: {e}")


def get_collection():
    """Returns the MongoDB collection instance, connecting or reconnecting if necessary."""
    try:
        # connect_db now handles checking existing connection and pinging
        return connect_db()
    except (ValueError, ConnectionError) as e:
        db_logger.error(f"Failed to get collection: {e}")
        raise # Re-raise the specific error caught by connect_db


def close_db_connection():
    """Closes the MongoDB client connection if it's open."""
    global _db_client, _db, _collection
    if _db_client:
        try:
            _db_client.close()
            db_logger.info("MongoDB connection closed.")
        except Exception as e:
             db_logger.error(f"Error closing MongoDB connection: {e}")
        finally:
             _db_client = None
             _db = None
             _collection = None

# --- Database Operations ---

def create_user(username, password):
    """
    Creates a new user in the database if the username doesn't exist.
    Stores password in PLAINTEXT - HIGHLY INSECURE - FOR DEMO ONLY.
    """
    # !! SECURITY WARNING !! DO NOT STORE PLAINTEXT PASSWORDS IN PRODUCTION !!
    # !! Use a library like bcrypt:
    # !! import bcrypt
    # !! salt = bcrypt.gensalt()
    # !! hashed_pw = bcrypt.hashpw(password.encode('utf-8'), salt)
    db_logger.warning("SECURITY ALERT: Storing plaintext password in create_user!")
    try:
        collection = get_collection()
        if not collection:
            return CREATE_DB_ERROR # Indicate DB connection issue

        # Check if user already exists
        existing_user = collection.find_one({"username": username})
        if existing_user:
            db_logger.warning(f"Attempted to create existing user: '{username}'")
            return CREATE_USER_EXISTS

        # Create new user document (using plaintext password - BAD PRACTICE)
        new_user_doc = {
            "username": username,
            "password": password, # !! INSECURE !! Store hashed_pw instead
            "directories": [], # Initialize with empty list
            "phone_number": "", # Initialize with empty string
            "created_at": datetime.datetime.now(datetime.timezone.utc),
            "last_updated": datetime.datetime.now(datetime.timezone.utc)
        }
        result = collection.insert_one(new_user_doc)

        if result.inserted_id:
            db_logger.info(f"Successfully created new user: '{username}'")
            return CREATE_SUCCESS
        else:
            # This case should be rare if insert_one doesn't raise an error
            db_logger.error(f"User creation for '{username}' reported no inserted_id, though no exception was raised.")
            return CREATE_DB_ERROR

    except ConnectionError:
        db_logger.error(f"Database connection failed during user creation for '{username}'.")
        return CREATE_DB_ERROR
    except pymongo.errors.PyMongoError as pe:
        db_logger.error(f"MongoDB error creating user '{username}': {pe}")
        return CREATE_DB_ERROR
    except Exception as e:
        db_logger.error(f"Unexpected error creating user '{username}': {e}", exc_info=True)
        return CREATE_DB_ERROR


def verify_user(username, password):
    """
    Verifies user credentials against the database.
    Checks plaintext password - HIGHLY INSECURE - FOR DEMO ONLY.
    Returns status constants: AUTH_SUCCESS, AUTH_USER_NOT_FOUND, AUTH_INVALID_PASSWORD, AUTH_DB_ERROR.
    """
    # !! SECURITY WARNING !! DO NOT CHECK PLAINTEXT PASSWORDS IN PRODUCTION !!
    # !! Retrieve user, then use:
    # !! if user_data and bcrypt.checkpw(password.encode('utf-8'), user_data['password_hash']): return AUTH_SUCCESS
    db_logger.warning("SECURITY ALERT: Checking plaintext password in verify_user!")
    try:
        collection = get_collection()
        if not collection:
            return AUTH_DB_ERROR # Indicate DB connection issue

        user_data = collection.find_one({"username": username})

        if not user_data:
            db_logger.warning(f"Verification failed for user '{username}': User not found.")
            return AUTH_USER_NOT_FOUND
        else:
            # Plaintext password check (BAD PRACTICE)
            if user_data.get("password") == password:
                db_logger.info(f"User '{username}' verified successfully.")
                return AUTH_SUCCESS
            else:
                db_logger.warning(f"Verification failed for user '{username}': Invalid password.")
                return AUTH_INVALID_PASSWORD

    except ConnectionError:
        db_logger.error(f"Database connection failed during user verification for '{username}'.")
        return AUTH_DB_ERROR
    except pymongo.errors.PyMongoError as pe:
        db_logger.error(f"MongoDB error verifying user '{username}': {pe}")
        return AUTH_DB_ERROR
    except Exception as e:
        db_logger.error(f"Error verifying user '{username}': {e}", exc_info=True)
        return AUTH_DB_ERROR

def save_user_config(username, password, directories, phone_number):
    """
    Saves or updates user configuration in the database using username as the key.
    NOTE: Password handling here is also simplified for demonstration.
          Ideally, password shouldn't be updated here unless explicitly requested.
    """
    # !! SECURITY WARNING !! Resaving plaintext password is bad practice !!
    db_logger.warning("SECURITY ALERT: Saving potentially plaintext password in save_user_config!")
    try:
        collection = get_collection()
        if not collection:
             raise ConnectionError("Database connection not available for saving config.")

        # Data validation (basic)
        if not all([username, password, directories is not None, phone_number is not None]):
             raise ValueError("Missing required fields for saving configuration.")

        # Fields to update - Include password update as per original flow, but flag as insecure
        user_config_update = {
            "password": password, # Store plain text (INSECURE - DEMO ONLY)
            "directories": directories,
            "phone_number": phone_number,
            "last_updated": datetime.datetime.now(datetime.timezone.utc)
        }

        # Use update_one with upsert=False by default. We assume user exists from login.
        # If you wanted sign-up+config in one go, upsert=True might be needed,
        # but the current flow separates account creation.
        result = collection.update_one(
            {"username": username},
            {"$set": user_config_update}
            # upsert=False # User should exist if they reached config page
        )

        if result.modified_count > 0:
            db_logger.info(f"Configuration for user '{username}' saved successfully. Modified Count: {result.modified_count}")
            return True
        elif result.matched_count > 0 and result.modified_count == 0:
             db_logger.info(f"Configuration for user '{username}' already up-to-date.")
             return True
        elif result.matched_count == 0:
             db_logger.error(f"Config save failed for '{username}': User not found for update.")
             # This indicates a problem if the user logged in successfully but isn't found now
             raise RuntimeError(f"User '{username}' not found during config update.")
        else:
             # Should not happen with matched_count > 0
             db_logger.warning(f"Config save for '{username}' matched but didn't modify unexpectedly.")
             return False


    except ValueError as ve:
        db_logger.error(f"Data validation error saving config for '{username}': {ve}")
        raise ve
    except ConnectionError as ce: # Catch specific connection errors
         db_logger.error(f"Database connection failed while saving config for '{username}': {ce}")
         raise ConnectionError(f"Database error: {ce}") # Re-raise standard error type
    except pymongo.errors.PyMongoError as pe:
        db_logger.error(f"MongoDB error saving config for '{username}': {pe}")
        raise ConnectionError(f"Database error: {pe}") # Re-raise standard error type
    except Exception as e:
        db_logger.error(f"Unexpected error saving config for '{username}': {e}", exc_info=True)
        raise RuntimeError(f"An unexpected error occurred: {e}") # Re-raise standard error type