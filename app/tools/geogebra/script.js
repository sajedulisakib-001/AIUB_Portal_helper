export function tool(path) {
  const skippedPoints = document.getElementById("skippedPoints");
  const output = document.getElementById("output");
  const getData = document.getElementById("getData");
  const status = document.getElementById("status");
  const copyBtn = document.getElementById("copyBtn");
  const howToUseBtn = document.getElementById("howToUseBtn");

  const tabExtractBtn = document.getElementById("tabExtractBtn");
  const tabColorBtn = document.getElementById("tabColorBtn");
  const pageExtract = document.getElementById("pageExtract");
  const pageColor = document.getElementById("pageColor");

  const swatch = document.getElementById("swatch");

  howToUseBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`${path}help.html`) });
  });

  // In-popup tab navigation -- switches which page is visible without
  // ever leaving the popup window (no new browser tab involved).
  function showPage(page) {
    const showingExtract = page === "extract";

    pageExtract.classList.toggle("hidden", !showingExtract);
    pageColor.classList.toggle("hidden", showingExtract);
    tabExtractBtn.classList.toggle("active", showingExtract);
    tabColorBtn.classList.toggle("active", !showingExtract);

    status.textContent = "";
  }

  tabExtractBtn.addEventListener("click", () => showPage("extract"));
  tabColorBtn.addEventListener("click", () => showPage("color"));

  async function loadSettings() {
    const data = await chrome.storage.local.get(["skippedPoints"]);
    if (data.skippedPoints) skippedPoints.value = data.skippedPoints;
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      skippedPoints: skippedPoints.value,
    });
  }

  getData.addEventListener("click", async () => {
    status.textContent = "Reading GeoGebra...";

    try {
      await saveSettings();

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.id) {
        throw new Error("No active tab found.");
      }

      const config = {
        skippedPoints: skippedPoints.value
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean),
      };

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: extractGeoGebraPoints,
        args: [config],
      });

      const data = result[0]?.result;

      if (!data) {
        throw new Error("No data returned.");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const blocks = data.groups.map((group) => {
        const header = group.name ? `// ${group.name}\n` : "";
        const colorLine = group.color
          ? `glColor3f(${group.color.r.toFixed(2)}, ${group.color.g.toFixed(2)}, ${group.color.b.toFixed(2)});\n`
          : "";
        return (
          header +
          colorLine +
          "glBegin(GL_POLYGON);\n\t" +
          group.lines.join("\n\t") +
          "\nglEnd();"
        );
      });

      output.value = blocks.join("\n\n");
      status.textContent = `${data.groups.length} shape(s), ${data.totalCount} point(s) found.`;
    } catch (error) {
      status.textContent = error.message;
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (!output.value) {
      status.textContent = "Nothing to copy yet.";
      return;
    }

    const originalLabel = copyBtn.textContent;

    const showCopied = () => {
      copyBtn.textContent = "Copied!";
      status.textContent = "Copied to clipboard.";
      setTimeout(() => {
        copyBtn.textContent = originalLabel;
      }, 1200);
    };

    try {
      await navigator.clipboard.writeText(output.value);
      showCopied();
    } catch (e) {
      // Fallback for contexts where the Clipboard API is blocked
      output.select();
      document.execCommand("copy");
      showCopied();
    }
  });



  function extractGeoGebraPoints(config) {
    if (typeof ggbApplet === "undefined") {
      return {
        error: "GeoGebra applet was not found on this page.",
      };
    }

    const skipped = config.skippedPoints || [];

    // Normalize a name for comparison: uppercase, strip underscores and
    // braces so "A1", "A_1", and "A_{1}" all collapse to the same form
    // for matching against the skip list.
    function normalize(name) {
      return name.toUpperCase().replace(/[_{}]/g, "");
    }

    // GeoGebra's own naming convention (per the official manual): typing
    // A1 into the input bar auto-converts it to "A_1" -- a single-digit
    // subscript needs no braces. But as soon as the subscript is more
    // than one character (e.g. index 10), GeoGebra requires -- and
    // stores -- brace form: "A_{10}". So a real construction can contain
    // any of: "A" (no index), "A1" (typed as plain digits, no
    // underscore), "A_1" (single-digit subscript), or "A_{10}"
    // (multi-digit subscript). This pattern matches all four:
    //   - ([A-Z]+)         the leading letters, e.g. "A", "AB"
    //   - _?                an optional underscore
    //   - \{?               an optional opening brace (multi-digit form)
    //   - (\d*)             the digits themselves, if any
    //   - \}?               an optional closing brace
    const nameRegex = /^([A-Z]+)_?\{?(\d*)\}?$/;

    function isActive(name) {
      try {
        if (!ggbApplet.exists(name)) return false;

        // Skip deselected / hidden / inactive points.
        if (!ggbApplet.getVisible(name)) return false;

        // getValue() throws or is unreliable for some non-numeric
        // objects; wrap defined-check separately so a bad object
        // doesn't kill the whole scan.
        if (
          typeof ggbApplet.isDefined === "function" &&
          !ggbApplet.isDefined(name)
        ) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    }

    // Pull a plain string value out of a text object, e.g. the
    // algebra-view label "Square" -> "Square" (strip "name = " prefix
    // and surrounding quotes that getValueString tends to include).
    function getTextValue(name) {
      try {
        let v = ggbApplet.getValueString(name);
        const eqIdx = v.indexOf("=");
        if (eqIdx !== -1) v = v.slice(eqIdx + 1);
        v = v
          .trim()
          .replace(/^["“”](.*)["“”]$/, "$1")
          .trim();
        return v || name;
      } catch (e) {
        return name;
      }
    }

    // Labels can carry a color suffix like "Square-c(#FFFFFF)".
    // Splits that into { name: "Square", color: {r,g,b} } (0-1 floats,
    // ready for glColor3f). If there's no "-c(#hex)" suffix, color is null.
    function parseGroupLabel(text) {
      const match =
        /^(.*?)-c\(\s*#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\s*\)\s*$/.exec(text);
      if (!match) {
        return { name: text, color: null };
      }

      const name = match[1].trim();
      let hex = match[2];
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((ch) => ch + ch)
          .join("");
      }

      const color = {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
      };

      return { name, color };
    }

    // Walk every object in algebra-view (creation) order. Each text
    // object starts a new group/shape; points collected after it
    // belong to that shape, until the next text object starts a new one.
    let allNames = [];
    try {
      allNames = ggbApplet.getAllObjectNames();
    } catch (e) {
      return { error: "Could not read objects from GeoGebra." };
    }

    const groups = [];
    let currentGroup = { name: null, color: null, candidates: [] };
    groups.push(currentGroup);

    for (const rawName of allNames) {
      let type;
      try {
        type = ggbApplet.getObjectType(rawName);
      } catch (e) {
        continue;
      }

      if (type === "text") {
        const { name, color } = parseGroupLabel(getTextValue(rawName));
        currentGroup = { name, color, candidates: [] };
        groups.push(currentGroup);
        continue;
      }

      if (type !== "point") continue;

      const match = nameRegex.exec(rawName);
      if (!match) continue; // ignore points not named like A, B1, C_2...

      const letters = match[1];
      const suffixNum = match[2] === "" ? 0 : parseInt(match[2], 10);
      const normName = normalize(rawName);

      if (skipped.indexOf(normName) !== -1) continue;
      if (!isActive(rawName)) continue;

      currentGroup.candidates.push({ rawName, letters, suffixNum });
    }

    // Drop the leading placeholder group if nothing landed in it
    // before the first text label (avoids an empty unnamed shape).
    if (groups.length > 1 && groups[0].candidates.length === 0) {
      groups.shift();
    }

    const outputGroups = [];
    let totalCount = 0;

    for (const group of groups) {
      if (group.candidates.length === 0) continue;

      // Every active, non-skipped point collected for this shape is
      // included, regardless of how high its subscript number goes.
      const filtered = group.candidates;

      // Sort: suffix group first (A-Z, then 1-group, then 2-group...),
      // then alphabetically by letters within each group.
      filtered.sort((a, b) => {
        if (a.suffixNum !== b.suffixNum) return a.suffixNum - b.suffixNum;
        if (a.letters < b.letters) return -1;
        if (a.letters > b.letters) return 1;
        return 0;
      });

      const pointCoordinates = filtered.map((c) => ({
        name: c.rawName,
        x: ggbApplet.getXcoord(c.rawName),
        y: ggbApplet.getYcoord(c.rawName),
      }));

      const lines = pointCoordinates.map(
        (point) =>
          `glVertex2f(${point.x.toFixed(2)}, ${point.y.toFixed(2)});//${point.name}`,
      );

      outputGroups.push({
        name: group.name,
        color: group.color,
        lines: lines,
        count: lines.length,
      });

      totalCount += lines.length;
    }

    if (outputGroups.length === 0) {
      return { error: "No active points found." };
    }

    return {
      groups: outputGroups,
      totalCount: totalCount,
    };
  }

  loadSettings();
}
