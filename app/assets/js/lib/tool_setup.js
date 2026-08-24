/**
 * Fetches app/tools/{tool}/metadata.json for a tool folder.
 * Returns the parsed metadata (with `path` attached) or null
 * if it could not be loaded.
 */
async function fetchToolMetadata(tool) {
  const path = `app/tools/${tool}/metadata.json`;

  try {
    const response = await fetch(chrome.runtime.getURL(path));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    return {
      ...json,
      path: tool,
    };
  } catch (error) {
    console.error(`Error loading ${path}:`, error);

    return null;
  }
}

// `tool` is the actual folder name and the tool nickname.
export async function storeMetadataInStorage(tool) {
  const { ["tools-metadata"]: existingTools = [] } =
    await chrome.storage.local.get("tools-metadata");

  const currentTools = Array.isArray(existingTools) ? existingTools : [];

  /*
   * Check for a duplicate first, before doing any of the more
   * expensive metadata fetching / file validation work below.
   */
  if (currentTools.some((item) => item.path === tool)) {
    return {
      success: false,
      error: "DUPLICATE_METADATA",
      message: `Tool "${tool}" already exists in tools-metadata.`,
      tool,
    };
  }

  const newTool = await fetchToolMetadata(tool);

  /*
   * Metadata file could not be loaded.
   */
  if (!newTool) {
    return {
      success: false,
      error: "METADATA_LOAD_FAILED",
      message: `Could not load metadata.json for tool "${tool}".`,
      tool,
    };
  }

  /*
   * Validate metadata and all referenced tool files.
   */
  const validation = await validateAllFiles(newTool, tool);

  if (!validation.success) {
    return validation;
  }

  /*
   * Save the validated tool metadata.
   *
   * NOTE: this is a read-modify-write against chrome.storage.local.
   * Callers must not invoke storeMetadataInStorage() for multiple
   * tools concurrently (e.g. via Promise.all) or later writes will
   * silently clobber earlier ones. Add tools one at a time instead.
   */
  await chrome.storage.local.set({
    "tools-metadata": [...currentTools, newTool],
  });

  return {
    success: true,
    error: null,
    message: `Tool "${tool}" was successfully stored.`,
    tool,
    metadata: newTool,
  };
}

async function validateAllFiles(metadata, path) {
  /*
   * Validate metadata object.
   */
  if (!metadata || typeof metadata !== "object") {
    return {
      success: false,
      error: "INVALID_METADATA",
      message: "Tool metadata is missing or is not an object.",
      path,
    };
  }

  /*
   * Validate tool path.
   */
  if (!path || typeof path !== "string") {
    return {
      success: false,
      error: "INVALID_TOOL_PATH",
      message: "Tool path is missing or is not a string.",
      path,
    };
  }

  const base = `app/tools/${path}`;
  const actions = metadata.actions || {};

  /*
   * Test whether a file exists and optionally return its content.
   */
  const fileExists = async (filePath) => {
    try {
      const response = await fetch(chrome.runtime.getURL(filePath));

      if (!response.ok) {
        return { exists: false, content: null };
      }

      return { exists: true, content: await response.text() };
    } catch (error) {
      return { exists: false, content: null };
    }
  };

  /*
   * Detect real <script> tags while ignoring HTML comments.
   */
  const hasScript = (html) => {
    if (typeof html !== "string") {
      return false;
    }

    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

    return /<script\b[^>]*>/i.test(withoutComments);
  };

  /*
   * ============================================================
   * Validate JavaScript action
   * ============================================================
   */

  if (actions.run) {
    /*
     * actions.script must exist.
     */
    if (!actions.script || typeof actions.script !== "string") {
      return {
        success: false,
        error: "INVALID_SCRIPT_PROPERTY",
        message:
          "actions.run is enabled, but actions.script is missing or is not a string.",
        path,
      };
    }

    /*
     * metadata.entry is required when run action is enabled.
     */
    if (!metadata.entry) {
      return {
        success: false,
        error: "MISSING_ENTRY",
        message: "metadata.entry is required when actions.run is enabled.",
        path,
      };
    }

    const scriptPath = `${base}/${actions.script}.js`;

    try {
      /*
       * Check whether JavaScript file exists.
       */
      const script = await fileExists(scriptPath);

      if (!script.exists) {
        return {
          success: false,
          error: "SCRIPT_NOT_FOUND",
          message: `JavaScript file was not found: ${scriptPath}`,
          path: scriptPath,
        };
      }

      /*
       * Validate JavaScript file integrity (hash check).
       */
      const integrityChecker = await import(
        chrome.runtime.getURL("app/assets/js/lib/tools_integrity_checker.js")
      );

      showValidationStatus(
        `Validating ${scriptPath}... This may take up to 10 seconds.`,
      );

      let validationResult;

      try {
        validationResult = await integrityChecker.validateScript(scriptPath);
      } catch (error) {
        console.error("Validation server error:", error);

        hideValidationStatus();

        return {
          success: false,
          error: "VALIDATION_SERVER_ERROR",
          message:
            "The validation server could not be reached. Please try again later.",
          path: scriptPath,
          details: error.message,
        };
      }

      hideValidationStatus();

      if (!validationResult) {
        return {
          success: false,
          error: "SCRIPT_VALIDATION_FAILED",
          message: `JavaScript validation failed for: ${scriptPath}`,
          path: scriptPath,
        };
      }

      /*
       * Import JavaScript module.
       */
      const module = await import(chrome.runtime.getURL(scriptPath));

      /*
       * Make sure tool() exists.
       */
      if (typeof module.tool !== "function") {
        return {
          success: false,
          error: "TOOL_FUNCTION_MISSING",
          message: `The JavaScript module does not export a tool() function: ${scriptPath}`,
          path: scriptPath,
        };
      }
    } catch (error) {
      console.error(`Failed to load tool script: ${scriptPath}`, error);

      return {
        success: false,
        error: "SCRIPT_LOAD_FAILED",
        message: `Failed to load JavaScript file: ${scriptPath}`,
        path: scriptPath,
        details: error.message,
      };
    }
  }

  /*
   * ============================================================
   * Validate entry HTML
   * ============================================================
   */

  if (metadata.entry) {
    /*
     * Entry must be a string.
     */
    if (typeof metadata.entry !== "string") {
      return {
        success: false,
        error: "INVALID_ENTRY",
        message: "metadata.entry must be a string.",
        path,
      };
    }

    const htmlPath = `${base}/${metadata.entry}.html`;

    const entry = await fileExists(htmlPath);

    /*
     * Entry HTML does not exist.
     */
    if (!entry.exists) {
      return {
        success: false,
        error: "ENTRY_HTML_NOT_FOUND",
        message: `Entry HTML file was not found: ${htmlPath}`,
        path: htmlPath,
      };
    }

    /*
     * Tool HTML must not contain executable script tags.
     */
    if (hasScript(entry.content)) {
      return {
        success: false,
        error: "SCRIPT_TAG_IN_HTML",
        message: `Executable <script> tag detected in tool HTML: ${htmlPath}`,
        path: htmlPath,
      };
    }
  }

  /*
   * ============================================================
   * Validate CSS action
   * ============================================================
   */

  if (actions.css) {
    /*
     * CSS value must be a string.
     */
    if (typeof actions.css !== "string") {
      return {
        success: false,
        error: "INVALID_CSS_PROPERTY",
        message: "actions.css must be a string.",
        path,
      };
    }

    const cssPath = `${base}/${actions.css}.css`;

    const css = await fileExists(cssPath);

    /*
     * CSS file does not exist.
     */
    if (!css.exists) {
      return {
        success: false,
        error: "CSS_NOT_FOUND",
        message: `CSS file was not found: ${cssPath}`,
        path: cssPath,
      };
    }
  }

  /*
   * ============================================================
   * Everything passed
   * ============================================================
   */

  return {
    success: true,
    error: null,
    message: "All tool validation checks passed.",
    path,
  };
}

function showValidationStatus(message) {
  const status = document.getElementById("validationStatus");
  const text = document.getElementById("validationStatusText");

  text.textContent = message;
  status.style.display = "flex";
}

function hideValidationStatus() {
  const status = document.getElementById("validationStatus");

  status.style.display = "none";
}
