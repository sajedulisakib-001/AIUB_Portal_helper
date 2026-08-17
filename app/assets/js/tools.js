/**
 * app/assets/js/tools.js
 *
 * Initializes the "Tools" menu: lists installed tools from chrome.storage.local,
 * and — when one is opened — mounts it inside a SANDBOXED iframe wired up to
 * a secure, validated RPC channel back to this privileged popup (see
 * app/assets/js/lib/tool-rpc.js).
 *
 * The tool iframe never receives chrome.* API access, directly or indirectly.
 * Every one of its files (index.html, style.css, script.js) is fetched here,
 * in this privileged context, and inlined into the iframe's srcdoc — the
 * tool never loads anything by chrome-extension:// URL, so it needs no
 * web-accessible-resource exposure at all.
 */

let _activeToolChannel = null;

/**
 * Initializes the "tools" menu functionality.
 * Handles menu transitions, loads content dynamically based on user selection,
 * and manages the back button to return to the menu.
 */
async function setupToolsMenu() {
    const menu = document.getElementById("toolsMenu");

    const { tools = [] } = await chrome.storage.local.get("tools");

    if (!Array.isArray(tools) || tools.length === 0) {
        menu.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h3>No Tools Found!</h3>
            </div>
        `;
        return;
    }
    const toolsData = await Promise.all(
        tools.map(async (tool) => {
            const path = `app/tools/${tool}/info.json`;

            try {
                const response = await fetch(chrome.runtime.getURL(path));

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                return {
                    ...json,
                    path: tool
                };
            } catch (err) {
                console.error(`Error loading ${path}:`, err);
                return null;
            }
        })
    );
    const toolsItems = document.getElementById("toolsItem");
    toolsData.forEach((data) => {
        if (!data) return;
        const li = document.createElement("li");
        li.classList.add("list-group-item");
        li.classList.add("option-btn");
        li.setAttribute("data-topic", data.path);
        li.innerText = data.name;
        toolsItems.appendChild(li);
    });


    const contentBox = document.getElementById("tools-container");
    const toolsContent = document.getElementById("tools-contents");
    const backBtn = document.getElementById("backToMenu");
    const options = document.querySelectorAll(".option-btn");

    options.forEach((option) => {
        option.addEventListener("click", async () => {

            console.log("Item Clicked!");

            const topic = option.getAttribute("data-topic");
            const toolMeta = toolsData.find((t) => t && t.path === topic) || {};

            menu.classList.add("fade-out");
            menu.addEventListener("animationend", async () => {
                menu.style.display = "none";
                menu.classList.remove("fade-out");
                backBtn.style.display = "block";
                contentBox.style.display = "block";
                contentBox.classList.add("fade-in");
                backBtn.classList.add("fade-in");

                toolsContent.innerHTML = "";
                _activeToolChannel = await mountTool(topic, toolMeta, toolsContent);

            }, { once: true });
        });
    });

    backBtn.addEventListener("click", () => {
        contentBox.classList.add("fade-out");
        contentBox.addEventListener("animationend", () => {
            contentBox.style.display = "none";
            contentBox.classList.remove("fade-out");
            backBtn.style.display = "none";
            backBtn.classList.remove("fade-in");
            menu.style.display = "block";
            menu.classList.add("fade-in");

            // Tear down the RPC listener and discard the iframe when leaving
            // a tool, so a closed tool can never keep receiving/sending messages.
            if (_activeToolChannel) {
                _activeToolChannel.destroy();
                _activeToolChannel = null;
            }
            toolsContent.innerHTML = "";
        }, { once: true });
    });
}

/**
 * Fetches a tool's index.html, style.css and script.js (plus the shared RPC
 * client), inlines all of it into one sandboxed iframe, appends it into
 * `container`, and opens its secure RPC channel.
 *
 * @param {string} folder - the tool's folder name under app/tools/.
 * @param {object} toolMeta - the tool's parsed info.json (name, homepage, ...).
 * @param {HTMLElement} container - element to mount the iframe into.
 * @returns {Promise<{ destroy: () => void }>} the tool's RPC channel.
 */
async function mountTool(folder, toolMeta, container) {
    const base = `app/tools/${folder}`;

    const [html, css, script, rpcClient] = await Promise.all([
        loadtoolsContent(`${base}/index.html`),
        loadtoolsContent(`${base}/style.css`),
        loadtoolsContent(`${base}/script.js`),
        loadtoolsContent(`app/tools/_shared/rpc-client.js`),
    ]);

    const iframe = document.createElement("iframe");

    // "allow-scripts" only: no allow-same-origin, no allow-forms, no
    // allow-popups, no allow-top-navigation. The tool gets a unique opaque
    // origin every time it's mounted, so it can never masquerade as the
    // extension, the popup, or any other tool.
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute(
        "srcdoc",
        `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>${css}</style>
                </head>

                <body>
                    ${html}
                    <script>${rpcClient}</script>
                    <script>${script}</script>
                </body>
            </html>
            `
    );

    container.appendChild(iframe);

    // toolCtx.toolId is `folder`, i.e. the value the user clicked in OUR own
    // menu — never anything the iframe could have sent us. This is what
    // keeps one tool's storage bucket unreadable/unwritable by any other tool.
    return createToolChannel(iframe, {
        toolId: folder,
        homepage: toolMeta.homepage || null,
    });
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
