export function tool(path) {
  const skippedPoints = document.getElementById("t-skippedPoints");
  const output = document.getElementById("t-output");
  const getData = document.getElementById("t-getData");
  const status = document.getElementById("t-status");
  const copyBtn = document.getElementById("t-copyBtn");
  const howToUseBtn = document.getElementById("t-howToUseBtn");

  const tabExtractBtn = document.getElementById("t-tabExtractBtn");
  const tabColorBtn = document.getElementById("t-tabColorBtn");
  const pageExtract = document.getElementById("t-pageExtract");
  const pageColor = document.getElementById("t-pageColor");

  howToUseBtn.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`${path}other/help.html`),
    });
  });

  // In-popup tab navigation -- switches which page is visible without
  // ever leaving the popup window (no new browser tab involved).
  let colorPickerReady = false;

  function showPage(page) {
    const showingExtract = page === "extract";

    pageExtract.classList.toggle("hidden", !showingExtract);
    pageColor.classList.toggle("hidden", showingExtract);
    tabExtractBtn.classList.toggle("active", showingExtract);
    tabColorBtn.classList.toggle("active", !showingExtract);

    status.textContent = "";

    // Lazily wire up the color picker the first time its tab is opened.
    // Re-running this on every tab switch would keep attaching new
    // input/drag listeners on top of the old ones, so it only ever runs once.
    if (!showingExtract && !colorPickerReady) {
      colorPickerReady = true;
      setupColorPicker();
    }
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

  function setupColorPicker() {
    // ---- state: h in [0,360), s,v in [0,1], a in [0,1] ----
    let h = 24,
      s = 0.075,
      v = 0.565,
      a = 1;
    // derived from screenshot roughly r0.565 g0.553 b0.533 -> low saturation warm gray

    const els = {
      swatch: document.getElementById("c-swatch"),
      rgb01Input: document.getElementById("c-rgb01Input"),
      hexInput: document.getElementById("c-hexInput"),
      rNum: document.getElementById("c-rNum"),
      gNum: document.getElementById("c-gNum"),
      bNum: document.getElementById("c-bNum"),
      aNum: document.getElementById("c-aNum"),
      rRange: document.getElementById("c-rRange"),
      gRange: document.getElementById("c-gRange"),
      bRange: document.getElementById("c-bRange"),
      aRange: document.getElementById("c-aRange"),
      rGrad: document.getElementById("c-rGrad"),
      gGrad: document.getElementById("c-gGrad"),
      bGrad: document.getElementById("c-bGrad"),
      aGrad: document.getElementById("c-aGrad"),
      svArea: document.getElementById("c-svArea"),
      svCursor: document.getElementById("c-svCursor"),
      hueTrack: document.getElementById("c-hueTrack"),
      hueCursor: document.getElementById("c-hueCursor"),
      alphaTrack: document.getElementById("c-alphaTrack"),
      alphaCursor: document.getElementById("c-alphaCursor"),
      toast: document.getElementById("c-toast"),
      eyedropBtn: document.getElementById("c-eyedropBtn"),
    };

    function hsv2rgb(h, s, v) {
      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;
      let r, g, b;
      if (h < 60) {
        r = c;
        g = x;
        b = 0;
      } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
      } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
      } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = x;
      }
      return [r + m, g + m, b + m];
    }

    function rgb2hsv(r, g, b) {
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const d = max - min;
      let hh = 0;
      if (d !== 0) {
        if (max === r) hh = 60 * (((g - b) / d) % 6);
        else if (max === g) hh = 60 * ((b - r) / d + 2);
        else hh = 60 * ((r - g) / d + 4);
      }
      if (hh < 0) hh += 360;
      const ss = max === 0 ? 0 : d / max;
      const vv = max;
      return [hh, ss, vv];
    }

    function clamp01(n) {
      return Math.min(1, Math.max(0, n));
    }

    function toHex2(n) {
      const v = Math.round(clamp01(n) * 255);
      return v.toString(16).padStart(2, "0");
    }

    function rgbToHex(r, g, b, alpha) {
      let hex = "#" + toHex2(r) + toHex2(g) + toHex2(b);
      if (alpha < 1) hex += toHex2(alpha);
      return hex;
    }

    function hexToRgb(hex) {
      hex = hex.trim().replace(/^#/, "");
      if (![3, 4, 6, 8].includes(hex.length)) return null;
      if (hex.length === 3 || hex.length === 4) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const al = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
      if ([r, g, b].some(isNaN)) return null;
      return [r, g, b, al];
    }

    let r, g, b;

    function syncFromHSV() {
      [r, g, b] = hsv2rgb(h, s, v);
      render();
    }

    function syncHSVFromRGB() {
      [h, s, v] = rgb2hsv(r, g, b);
      render();
    }

    function render() {
      // swatch
      els.swatch.style.setProperty(
        "--swatch-color",
        `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`,
      );

      // text fields
      els.rgb01Input.value = `glColor3f(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)});`;
      els.hexInput.value = rgbToHex(r, g, b, a);

      // channel numbers + ranges
      els.rNum.value = r.toFixed(3);
      els.gNum.value = g.toFixed(3);
      els.bNum.value = b.toFixed(3);
      els.aNum.value = a.toFixed(3);
      els.rRange.value = r;
      els.gRange.value = g;
      els.bRange.value = b;
      els.aRange.value = a;

      // channel gradients (vary that channel 0->1, holding others)
      els.rGrad.style.background = `linear-gradient(to right, rgba(0,${Math.round(g * 255)},${Math.round(b * 255)},1), rgba(255,${Math.round(g * 255)},${Math.round(b * 255)},1))`;
      els.gGrad.style.background = `linear-gradient(to right, rgba(${Math.round(r * 255)},0,${Math.round(b * 255)},1), rgba(${Math.round(r * 255)},255,${Math.round(b * 255)},1))`;
      els.bGrad.style.background = `linear-gradient(to right, rgba(${Math.round(r * 255)},${Math.round(g * 255)},0,1), rgba(${Math.round(r * 255)},${Math.round(g * 255)},255,1))`;
      els.aGrad.style.background = `linear-gradient(to right, rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},0), rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},1))`;

      // SV area background hue
      const [hr, hg, hb] = hsv2rgb(h, 1, 1);
      els.svArea.style.background = `rgb(${Math.round(hr * 255)},${Math.round(hg * 255)},${Math.round(hb * 255)})`;
      const svRect = { w: els.svArea.clientWidth, h: els.svArea.clientHeight };
      els.svCursor.style.left = s * svRect.w + "px";
      els.svCursor.style.top = (1 - v) * svRect.h + "px";
      els.svCursor.style.background = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;

      // hue cursor
      const hueW = els.hueTrack.clientWidth;
      els.hueCursor.style.left = (h / 360) * hueW + "px";

      // alpha cursor
      const alphaW = els.alphaTrack.clientWidth;
      els.alphaCursor.style.left = a * alphaW + "px";
    }

    // ---- init from screenshot values ----
    r = 0.565;
    g = 0.553;
    b = 0.533;
    a = 1;
    syncHSVFromRGB();

    // ---- number inputs ----
    function bindNumber(input, setter) {
      input.addEventListener("input", () => {
        let n = parseFloat(input.value);
        if (isNaN(n)) return;
        n = clamp01(n);
        setter(n);
        render();
      });
      input.addEventListener("blur", () => {
        render();
      });
    }
    bindNumber(els.rNum, (n) => {
      r = n;
      syncHSVFromRGB();
    });
    bindNumber(els.gNum, (n) => {
      g = n;
      syncHSVFromRGB();
    });
    bindNumber(els.bNum, (n) => {
      b = n;
      syncHSVFromRGB();
    });
    bindNumber(els.aNum, (n) => {
      a = n;
    });

    function bindRange(range, setter) {
      range.addEventListener("input", () => {
        setter(parseFloat(range.value));
        render();
      });
    }
    bindRange(els.rRange, (n) => {
      r = n;
      [h, s, v] = rgb2hsv(r, g, b);
    });
    bindRange(els.gRange, (n) => {
      g = n;
      [h, s, v] = rgb2hsv(r, g, b);
    });
    bindRange(els.bRange, (n) => {
      b = n;
      [h, s, v] = rgb2hsv(r, g, b);
    });
    bindRange(els.aRange, (n) => {
      a = n;
    });

    // ---- text field parsing ----
    els.rgb01Input.addEventListener("change", () => {
      const m = els.rgb01Input.value.match(
        /glColor3f?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i,
      );
      if (m) {
        r = clamp01(parseFloat(m[1]));
        g = clamp01(parseFloat(m[2]));
        b = clamp01(parseFloat(m[3]));
        syncHSVFromRGB();
      } else {
        render();
      }
    });

    els.hexInput.addEventListener("change", () => {
      const parsed = hexToRgb(els.hexInput.value);
      if (parsed) {
        [r, g, b, a] = parsed;
        syncHSVFromRGB();
      } else {
        render();
      }
    });

    // ---- copy buttons ----
    document.querySelectorAll(".c-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-copy");
        const val = document.getElementById(targetId).value;
        navigator.clipboard
          .writeText(val)
          .then(() => showToast("Copied " + val));
      });
    });

    function showToast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add("show");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => els.toast.classList.remove("show"), 1200);
    }

    // ---- SV area drag ----
    function setSVFromEvent(clientX, clientY) {
      const rect = els.svArea.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width;
      let y = (clientY - rect.top) / rect.height;
      x = clamp01(x);
      y = clamp01(y);
      s = x;
      v = 1 - y;
      syncFromHSV();
    }
    function dragHandler(moveSetter) {
      return function (e) {
        e.preventDefault();
        const isTouch = e.type.startsWith("touch");
        function move(ev) {
          const point = isTouch ? ev.touches[0] : ev;
          moveSetter(point.clientX, point.clientY);
        }
        move(e);
        function up() {
          window.removeEventListener(isTouch ? "touchmove" : "mousemove", move);
          window.removeEventListener(isTouch ? "touchend" : "mouseup", up);
        }
        window.addEventListener(isTouch ? "touchmove" : "mousemove", move, {
          passive: false,
        });
        window.addEventListener(isTouch ? "touchend" : "mouseup", up);
      };
    }
    els.svArea.addEventListener("mousedown", dragHandler(setSVFromEvent));
    els.svArea.addEventListener("touchstart", dragHandler(setSVFromEvent), {
      passive: false,
    });

    // ---- hue track drag ----
    function setHueFromEvent(clientX) {
      const rect = els.hueTrack.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width;
      x = clamp01(x);
      h = x * 360;
      if (h >= 360) h = 359.999;
      syncFromHSV();
    }
    els.hueTrack.addEventListener(
      "mousedown",
      dragHandler((cx) => setHueFromEvent(cx)),
    );
    els.hueTrack.addEventListener(
      "touchstart",
      dragHandler((cx) => setHueFromEvent(cx)),
      { passive: false },
    );

    // ---- alpha track drag ----
    function setAlphaFromEvent(clientX) {
      const rect = els.alphaTrack.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width;
      a = clamp01(x);
      render();
    }
    els.alphaTrack.addEventListener(
      "mousedown",
      dragHandler((cx) => setAlphaFromEvent(cx)),
    );
    els.alphaTrack.addEventListener(
      "touchstart",
      dragHandler((cx) => setAlphaFromEvent(cx)),
      { passive: false },
    );

    // ---- eyedropper ----
    // Prefer the native EyeDropper API (Chrome/Edge). Everywhere else, fall back
    // to the browser's own color picker dialog, which on most platforms
    // (Windows, macOS, Firefox, Chrome) has its own built-in eyedropper tool.
    const nativeColorInput = document.getElementById("c-nativeColorInput");

    function applyHex(hex) {
      const parsed = hexToRgb(hex);
      if (parsed) {
        [r, g, b] = parsed;
        syncHSVFromRGB();
      }
    }

    if ("EyeDropper" in window) {
      els.eyedropBtn.addEventListener("click", async () => {
        try {
          const ed = new EyeDropper();
          const result = await ed.open();
          applyHex(result.sRGBHex);
        } catch (e) {
          /* user cancelled - no-op */
        }
      });
    } else {
      els.eyedropBtn.title = "Pick color (opens system color picker)";
      els.eyedropBtn.addEventListener("click", () => {
        nativeColorInput.value = rgbToHex(r, g, b, 1);
        nativeColorInput.click();
      });
      nativeColorInput.addEventListener("input", () =>
        applyHex(nativeColorInput.value),
      );
    }

    // re-render cursor positions on resize (layout-dependent)
    window.addEventListener("resize", render);

    render();
  }

  loadSettings();
}
 