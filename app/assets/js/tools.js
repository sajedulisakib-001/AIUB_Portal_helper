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

  const openTool = (toolName, toolsData) => {
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
    openTool(toolName, allToolsData);
    return;
  }

  // Load metadata for all tools from tools-metadata
  let { ["tools-metadata"]: toolsData = [] } =
    await chrome.storage.local.get("tools-metadata");

  console.log(toolsData);
  if (toolsData.length === 0) {
    await Promise.all(
      defaultTools().map((tool) => storeMetadataInStorage(tool)),
    );

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
