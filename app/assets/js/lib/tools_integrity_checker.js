async function calculateSHA256(buffer) {
    const hash = await crypto.subtle.digest("SHA-256", buffer);

    return [...new Uint8Array(hash)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}


async function getServerHash() {
    const response = await fetch(
        "https://your-server.com/api/file-hash",
        {
            cache: "no-store"
        }
    );

    if (!response.ok)
        throw new Error("Failed to get server hash");

    const data = await response.json();

    return data.hash.trim().toLowerCase();
}


async function validateFile(filePath) {

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
        // const serverHash = await getServerHash();

        // Compare
        if (localHash === "865041d13c01911fa7af4d5e6595de31b4acfef2425fca681f7ca5130cc31dc6") {

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