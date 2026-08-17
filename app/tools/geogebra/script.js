/**
 * app/tools/geogebra/script.js
 *
 * Runs inside this tool's sandboxed iframe. The ONLY way it can reach
 * anything privileged (storage, tabs, etc.) is `callParent(...)`, provided
 * by the shared RPC client the popup inlines before this file runs.
 *
 * Demonstrates: reading/writing this tool's own isolated storage bucket.
 * Another tool calling callParent("getStorage", { key: "lastTestValue" })
 * gets its OWN bucket back, never this one.
 */

const testInput = document.querySelector(".input");
const testBtn = document.querySelectorAll(".btn-primary")[1]; // the "Test" button

// Restore whatever this tool last saved for itself.
(async () => {
    try {
        const { value } = await callParent("getStorage", { key: "lastTestValue" });
        if (value && testInput) testInput.value = value;
    } catch (err) {
        console.error("Failed to load saved value:", err);
    }
})();

testBtn?.addEventListener("click", async () => {
    const value = testInput?.value ?? "";
    try {
        await callParent("saveStorage", { key: "lastTestValue", value });
        alert(`Saved "${value}" — isolated to this tool only.`);
    } catch (err) {
        alert(`Save failed: ${err.message}`);
    }
});
