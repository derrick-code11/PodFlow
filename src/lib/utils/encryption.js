import { auth } from "../firebase";

/**
 * Encrypts sensitive data using Web Crypto API
 */
export async function encryptData(text) {
  if (!text) return "";

  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to encrypt data");

    // Create a key from the user's UID
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(uid),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    // Generate salt
    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    // Derive the key
    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // Generate IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encoder.encode(text)
    );

    // Convert encrypted data to string
    const encryptedArray = Array.from(new Uint8Array(encryptedContent));
    const saltArray = Array.from(salt);
    const ivArray = Array.from(iv);

    // Return encrypted data with salt and IV
    return JSON.stringify({
      encrypted: encryptedArray,
      salt: saltArray,
      iv: ivArray,
    });
  } catch (error) {
    console.error("Encryption error:", error);
    return "";
  }
}

/**
 * Decrypts sensitive data using Web Crypto API
 * Handles both encrypted and legacy unencrypted data
 */
export async function decryptData(encryptedData) {
  if (!encryptedData) return "";

  try {
    // Try to parse as JSON (new encrypted format)
    let parsed;
    try {
      parsed = JSON.parse(encryptedData);
    } catch (parseError) {
      // If parsing fails, this might be legacy unencrypted data
      // Return as is, it will be encrypted on next save
      return encryptedData;
    }

    // If we successfully parsed but it's not in our expected format
    if (!parsed.encrypted || !parsed.salt || !parsed.iv) {
      return encryptedData;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to decrypt data");

    // Create a key from the user's UID
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(uid),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    // Derive the key
    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new Uint8Array(parsed.salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt the data
    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(parsed.iv),
      },
      key,
      new Uint8Array(parsed.encrypted)
    );

    // Convert decrypted data to string
    return new TextDecoder().decode(decryptedContent);
  } catch (error) {
    console.error("Decryption error:", error);
    return encryptedData;
  }
}
