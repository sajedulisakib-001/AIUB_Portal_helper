/**
 * Initializes the "tools" menu functionality.
 * Handles menu transitions, loads content dynamically based on user selection,
 * and manages the back button to return to the menu.
 */
async function setupToolsMenu(toolName = null, allToolsData = null) {
  const menu = document.getElementById("toolsMenu");
  const toolsItems = document.getElementById("toolsItem");
  const contentBox = document.getElementById("tools-container");
  const toolsContent = document.getElementById("tools-contents");
  const backBtn = document.getElementById("backToMenu");

  const openTool = async (toolName, toolsData) => {
    // Find metadata
    const toolMeta = toolsData.find((tool) => tool.path === toolName);

    if (!toolMeta) {
      console.error(`Tool metadata not found: ${toolName}`);
      return;
    }

    console.log("Item Clicked:", toolName);

    // Sandbox chrome.storage.local to this tool's own namespace before
    // any of its code runs, so it can't read or overwrite the extension's
    // own data (settings, credentials, notices, etc.) or another tool's
    // data. Deactivated again in the back-button handler below.
    deactivateToolStorage();
    activateToolStorage(toolName);

    // Hide menu
    menu.classList.add("fade-out");

    menu.addEventListener(
      "animationend",
      async () => {
        menu.style.display = "none";
        menu.classList.remove("fade-out");

        backBtn.style.display = "block";
        contentBox.style.display = "block";

        contentBox.classList.add("fade-in");
        backBtn.classList.add("fade-in");

        // Load tool HTML/UI
        try {
          toolsContent.innerHTML = await mountTool(toolName, toolMeta);
        } catch (error) {
          console.error(`Error mounting ${toolName}:`, error);

          toolsContent.innerHTML = `
                    <div style="padding: 30px; text-align: center;">
                        <h3>Failed to load tool</h3>
                    </div>
                `;

          return;
        }

        // Load tool JavaScript
        if (toolMeta.actions?.run) {
          await delay(50);
          try {
            const module = await import(
              chrome.runtime.getURL(
                `../../app/tools/${toolName}/${toolMeta.actions.script}.js`,
              )
            );

            // Make sure tool() exists
            if (typeof module.tool === "function") {
              await module.tool(`app/tools/${toolName}/`);
            } else {
              console.error(
                `${toolName}/${toolMeta.actions.script}.js does not export tool()`,
              );
            }
          } catch (error) {
            console.error(
              `Error loading ${toolName}/${toolMeta.actions.script}.js:`,
              error,
            );
          }
        }
      },
      { once: true },
    );
  };

  if (toolName !== null && allToolsData !== null) {
    await openTool(toolName, allToolsData);
    return;
  }

  // Load metadata for all tools from tools-metadata
  let { ["tools-metadata"]: toolsData = [] } =
    await chrome.storage.local.get("tools-metadata");

  console.log(toolsData);
  if (toolsData.length === 0) {
    const errorContainer = document.getElementById("error-container");
    errorContainer.style.display = "block";
    const result = await Promise.all(
      defaultTools().map((tool) => storeMetadataInStorageT(tool)),
    );
    result.forEach((e) => {
      if (!e.success) {
        const ec = document.createElement("div");
        ec.classList.add("error-container");

        const ei = document.createElement("span");
        ei.classList.add("error-icon");
        ei.textContent = "!";

        const em = document.createElement("span");
        em.classList.add("error-message");
        em.innerHTML = `${e.message}${e.path ? `<small>(Path: ${e.path})</small>` : ""}`;

        ec.append(ei);
        ec.append(em);

        errorContainer.appendChild(ec);
      }
    });
    setTimeout(() => {
        errorContainer.style.display = "none";
    }, 3000);

    ({ ["tools-metadata"]: toolsData = [] } =
      await chrome.storage.local.get("tools-metadata"));
  }

  // Create menu items
  toolsData.forEach((tool) => {
    const li = document.createElement("li");

    li.classList.add("list-group-item", "option-btn");

    li.dataset.topic = tool.path;
    li.innerText = tool.name;

    toolsItems.appendChild(li);
  });

  // Handle tool selection
  toolsItems.addEventListener("click", async (event) => {
    const option = event.target.closest(".option-btn");
    if (!option) {
      return;
    }
    const toolName = option.dataset.topic;
    await openTool(toolName, toolsData);
  });

  // Back button
  backBtn.addEventListener("click", () => {
    // Leaving the tool -- restore unrestricted storage access for the
    // rest of the extension.
    deactivateToolStorage();

    contentBox.classList.add("fade-out");

    contentBox.addEventListener(
      "animationend",
      () => {
        contentBox.style.display = "none";
        contentBox.classList.remove("fade-out");

        backBtn.style.display = "none";
        backBtn.classList.remove("fade-in");

        menu.style.display = "block";
        menu.classList.add("fade-in");

        toolsContent.innerHTML = "";
      },
      { once: true },
    );
  });
}

/**
 * Fetches a tool's index.html, style.css and script.js (plus the shared RPC
 * client), inlines all of it into one sandboxed iframe, appends it into
 * `container`, and opens its secure RPC channel.
 *
 * @param {string} folder - the tool's folder name under app/tools/.
 * @param {object} toolMeta - the tool's parsed info.json (name, homepage, ...).
 * @returns {string} // return html in plain text
 */
async function mountTool(folder, toolMeta) {
  const base = `app/tools/${folder}`;
  const actions = toolMeta.actions || {};

  const bodyFile = toolMeta.entry || "index";
  const cssFiles = actions.css || "style";

  const [htmlcontents, css] = await Promise.all([
    loadtoolsContent(`${base}/${bodyFile}.html`),
    loadtoolsContent(`${base}/${cssFiles}.css`),
  ]);

  return `
        <style>${css}</style>
        ${htmlcontents}
    `;
}

/**
 * Loads a text asset (HTML/CSS/JS) from the extension's own bundle.
 * @param {string} path - the path to load. relative to the extension root.
 * @returns {Promise<string>} - the loaded text content.
 */
async function loadtoolsContent(path) {
  try {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (err) {
    console.error(`Error loading ${path}:`, err);
    return "";
  }
}

function showNoTools() {
  document.getElementById("toolsMenu").innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h3>No Tools Found!</h3>
            </div>
        `;
  document.getElementById("toolsItem").innerHTML = "";
}

// `tool` is the actual folder name and the tool nickname.
async function storeMetadataInStorageT(tool) {
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
  const validation = await validateAllFilesT(newTool, tool);

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

async function validateAllFilesT(metadata, path) {
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
