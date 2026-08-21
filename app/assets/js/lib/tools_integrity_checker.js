async function calculateSHA256(buffer) {
    const hash = await crypto.subtle.digest("SHA-256", buffer);

    return [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

async function checkHash(value) {
  const response = await fetch("https://tools-integrity-checker.wasmer.app/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ string: value }),
  });
  const data = await response.json();
  return data.match; // true or false
}


async function validateScript(filePath) {

    try {

        // Get extension file
        const response = await fetch(
            chrome.runtime.getURL(filePath)
        );

        if (!response.ok)
            throw new Error("Failed to load extension file");

        // Read file
        const buffer = await response.arrayBuffer();

        // Calculate local hash
        const localHash = await calculateSHA256(buffer);

        // Get expected hash
        const isValid = await checkHash(localHash);

        // Compare
        if (isValid) {

            console.log("✓ File integrity verified");

            return true;

        } else {

            console.error("✗ File has been modified");

            return false;
        }

    } catch (error) {

        console.error("File validation failed:", error);

        return false;
    }
}

export { validateScript };