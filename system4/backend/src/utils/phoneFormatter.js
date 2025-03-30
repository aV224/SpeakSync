/**
 * Standardizes phone number format for consistent storage and lookup
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Handle different formats
  if (digitsOnly.length === 10) {
    // US number without country code: add +1
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US number with country code
    return `+${digitsOnly}`;
  } else if (digitsOnly.length > 8) {
    // Other international number, assuming it has country code
    return `+${digitsOnly}`;
  }
  
  // If we can't format it, return as is with + prefix
  return `+${digitsOnly}`;
}

/**
 * Format phone number for display
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number for display
 */
function formatPhoneNumberForDisplay(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove any non-digit characters except the + sign at the beginning
  const cleaned = phoneNumber.replace(/(?!^\+)\D/g, '');
  
  // Check if US/Canada number
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return `${cleaned.substring(0, 2)} (${cleaned.substring(2, 5)}) ${cleaned.substring(5, 8)}-${cleaned.substring(8)}`;
  }
  
  // Return with spaces for other international numbers
  // Add space after + and country code (assuming 1-3 digits)
  return cleaned.replace(/(\+\d{1,3})(\d+)/, function(match, countryCode, rest) {
    // Insert a space every 3 digits in the rest of the number
    const formatted = rest.replace(/(\d{3})(?=\d)/g, '$1 ');
    return `${countryCode} ${formatted}`;
  });
}

module.exports = {
  formatPhoneNumber,
  formatPhoneNumberForDisplay
}; 