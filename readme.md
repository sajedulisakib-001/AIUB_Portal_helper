# Aiub Portal Helper

Aiub Portal Helper is a Chrome extension for AIUB students that helps automate common portal-related tasks from a popup-based UI. The extension injects scripts into the AIUB portal, stores data locally in the browser, and displays the extracted information inside the extension without requiring the user to manually copy data between pages.

---

## Features

- **Auto-login**: Automatically fills saved credentials on the AIUB login page and attempts to solve the captcha using the Gemini API when an API key is configured.
- **Routine / class schedule**: Reads the student’s class schedule from the portal and shows it in the extension, including a tomorrow view and holiday hints.
- **Exam schedule**: Parses the exam routine page and displays the upcoming exam timetable inside the extension.
- **Unlocked courses**: Uses completed course data and prerequisite information to suggest which courses are currently unlocked.
- **Notices**: Fetches and displays AIUB notices from a remote endpoint and keeps track of which ones have been viewed.
- **Settings**: Lets users enable auto-login, save credentials, configure the Gemini API key, and choose when tomorrow’s routine should appear.

---

## Installation

1. Clone or download this repository to your local machine.
2. Unzip the file if needed and keep the folder in a safe place so it is not deleted.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable **Developer Mode** in the top-right corner.
5. Click **Load unpacked** and select the project folder.
6. Open the AIUB portal and use the extension popup to load data for the first time.

---

## Update

1. Download the latest version of the repository and replace the existing extension files with the new ones.
2. In Chrome, open `chrome://extensions/` and click **Reload** on the extension.
3. If the extension shows an update notice on the Home page, you can also reload the extension after installing the new files.

---

## Usage

1. **Initial setup**:
   - Open the extension popup after installing it.
   - If the popup shows the welcome screen, click **Load Data** to fetch your routine, course info, and unlocked course data from the portal.

2. **Home**:
   - View your current class routine and today/tomorrow schedule.
   - When exam data is available, the home page can switch to exam-focused display automatically.

3. **Others**:
   - Open **Others** to access the **Unlocked Courses** and **Exam Schedule** sections.
   - Use the reload button on these pages to refresh the latest data.

4. **Notice**:
   - Open **Notice** to view recent notices from the AIUB portal feed.
   - Clicking a notice opens the linked page.

5. **Settings**:
   - Open **Settings** to enable auto-login, save your AIUB login details, add your Gemini API key, and choose the time for tomorrow’s routine preview.

---

## Configuration

### Gemini API key for auto-login
To use the captcha-solving feature, you need a Gemini API key.

1. Open the **Settings** page in the extension.
2. Enable **Auto Login**.
3. Enter your AIUB username and password.(Optional)
4. Paste your Gemini API key into the **API Key** field.
5. Save the settings.

The extension stores these values locally in the browser profile using `chrome.storage.local`.

---

## File Structure

```text
AIUB_Portal_Helper/
├── app/
│   ├── assets/
│   │   ├── css/               # Extension popup styles
│   │   ├── icons/             # Extension icons
│   │   ├── js/                # Popup logic, portal parsers, and injected scripts
│   │   │   ├── lib/           # Shared helper utilities
│   │   │   └── toInject/      # Content scripts injected into portal pages
│   │   └── json/              # Course and holiday data used by the UI
│   └── pages/                 # Popup page HTML templates (home, notice, other, settings)
├── background.js              # Service worker that injects scripts when the portal loads
├── index.html                 # Popup UI entry point
├── manifest.json              # Manifest V3 extension configuration
└── readme.md                  # Project documentation
```

---

## Permissions

The extension uses the following permissions:

- **`scripting`**: Injects scripts into AIUB portal pages.
- **`tabs`**: Reads tab information and interacts with the active browser tab.
- **`storage`**: Stores routine data, settings, notices, exam schedules, and cached course information locally.
- **`host_permissions`**: Allows access to `https://portal.aiub.edu/*` pages.

---

## Troubleshooting

1. **Auto-login is not working**:
   - Make sure **Auto Login** is enabled in Settings.
   - Confirm that the Gemini API key is entered correctly.
   - Check that you are on the AIUB login page, not another portal page.

2. **No routine or course data appears**:
   - Open the extension popup and click **Load Data** if you are seeing the welcome screen.
   - Try reloading the extension from `chrome://extensions/`.
   - Open the browser console (`Ctrl + Shift + J`) to check for errors.

3. **Exam or unlocked course data is missing**:
   - Open the relevant portal pages and let the injected scripts run.
   - Use the reload button on the **Others** page to fetch updated data.

4. **The extension does not load properly**:
   - Verify that the project folder is loaded as an unpacked extension in Chrome.
   - Make sure the extension is not being blocked by a browser policy or corrupted installation.

---

## License

This repository does not currently include a `LICENSE` file. If you plan to redistribute or contribute to the project, a license should be added.

---

## Contributing

Contributions are welcome. If you find a bug or want to improve the extension, feel free to open an issue or submit a pull request.


---
## Note: 
<sub>😶‍🌫️This README.md was generated using AI.</sub>