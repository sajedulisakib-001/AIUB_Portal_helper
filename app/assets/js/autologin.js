/**
 * Immediately Invoked Function Expression (IIFE) to encapsulate auto-login logic.
 */
(() => {
  let iscaptchaSolved = false;

  /**
   * Retrieves extension settings from chrome.storage.local asynchronously.
   * @returns {Promise<Object>} - Resolves to the settings object.
   */
  const getSettingsAsync = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (result) => {
        resolve(result.settings || {});
      });
    });
  };

  const autoUserandPassFill = (settings) =>{
    const userInput = document.querySelector("input[name='UserName']");
    const passInput = document.querySelector("input[name='Password']");
    if (userInput && settings.username) {
      userInput.value = settings.username;
    }
    if (passInput && settings.password) {
      passInput.value = settings.password;
    } 
  }

  /**
   * Initializes the auto-login process.
   * Checks if on the login page, loads settings, and starts captcha solving if enabled.
   */
  const init = async () => {
    if (!(document.querySelector('.login_header'))) {
      if((isErrorPage=document.querySelector('body > span > h2 > i'))&& 
        isErrorPage.innerText.includes("The provided anti-forgery token was meant for user")) 
          location.replace(location.href);
      console.log("Not on the login page.");
      return;
    }
    const settings = await getSettingsAsync();

    if (!settings.autoLogin) {
      console.log("Auto-login is disabled.");
      return;
    }

    if (!settings.apiKey) {
      console.error("API key not found in chrome.storage.local.");
      return;
    }
    
    autoUserandPassFill(settings);
    

    attachInputEvents();
    await solveCaptcha(settings.apiKey);
  };
  

  /**
   * Attaches input and click event listeners to login form fields to trigger auto-submit.
   */
  const attachInputEvents = () => {
    const selectors = [
      "input[name='Username']",
      "input[name='Password']",
      "#CaptchaInputText",
    ];

    selectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.addEventListener("input", attemptSubmit);
        el.addEventListener("click", attemptSubmit);
      }
    });
  };

  /**
   * Attempts to submit the login form if captcha is solved and credentials are filled.
   */
  const attemptSubmit = () => {
    const user = document.querySelector("input[name='UserName']")?.value.trim();
    const pass = document.querySelector("input[name='Password']")?.value.trim();

    if (iscaptchaSolved && user && pass) {
      document
        .querySelector("button[type='submit'], input[type='submit']")
        ?.click();
    }
  };

  /**
   * Solves the captcha using the Gemini API and fills the result in the input field.
   * @param {string} apiKey - The Gemini API key.
   */
  const solveCaptcha = async (apiKey) => {
    const img = document.getElementById("CaptchaImage");
    const input = document.getElementById("CaptchaInputText");

    if (!img || !input) {
      console.warn("Captcha image or input field not found.");
      return;
    }

    await waitForImageLoad(img);

    try {
      const base64 = convertToBase64(img);
      console.log(base64);
      const result = await queryGemini(base64, apiKey);

      if (result) {
        input.value = result;
        iscaptchaSolved = true;
        attemptSubmit();
      }
    } catch (err) {
      console.error("Captcha solve error:", err);
    }
  };

  /**
   * Waits for the captcha image to finish loading before proceeding.
   * @param {HTMLImageElement} img - The captcha image element.
   * @returns {Promise<void>}
   */
  const waitForImageLoad = (img) => {
    return new Promise((resolve) => {
      if (img.complete && img.naturalHeight > 0) return resolve();
      img.onload = resolve;
    });
  };

  /**
   * Converts an image element to a base64-encoded PNG string.
   * @param {HTMLImageElement} img - The image element.
   * @returns {string} - The base64 string (without the data URL prefix).
   */
  const convertToBase64 = (img) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  };

  /**
   * Sends the captcha image to the Gemini API for solving.
   * @param {string} imageData - The base64-encoded image data.
   * @param {string} apiKey - The Gemini API key.
   * @returns {Promise<string>} - The solved captcha text.
   */
  const queryGemini = async (imageData, apiKey) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Solve the math and return only the result",
                },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: imageData,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const json = await response.json();

    if (json.error) throw new Error(json.error.message);
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  };

  // Start the auto-login process
  init();
})();