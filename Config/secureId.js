const crypto = require('crypto');

function generateSecureUUID() {
  // Use Node's crypto module to generate secure random bytes
  const randomBytes = crypto.randomBytes(16);
  
  // Set version (4) and variant (RFC4122) bits
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
  
  // Convert to hex string in UUID format
  return [...randomBytes].map(b => b.toString(16).padStart(2, '0')).join('')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

module.exports = { generateSecureUUID };