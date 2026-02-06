# Aiub Portal Helper

Aiub Portal Helper is a Chrome extension designed to assist AIUB students by automating tasks such as auto-login, fetching unlocked courses, displaying exam schedules, and more.

---

## Features

- **Auto-Login**: Automatically logs in to the AIUB portal using saved credentials and solves captchas using an API key.
- **Unlocked Courses**: Displays a list of unlocked courses based on completed prerequisites.
- **Exam Schedule**: Fetches and displays the exam schedule for the user's courses and sections.
- **Routine Management**: Retrieves and displays the user's class routine.
- **Settings Page**: Allows users to configure auto-login preferences and API keys.

---

## Installation

1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer Mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder.

---
---

## Update

1. Download the updated version from GitHub and extract it.
2. Copy all the files from the root folder of the new version.
3. Navigate to your previous extension folder and paste the new files to overwrite with the old ones.
4. Open the extension again and click on 'Reload Extension' inside the Extension Update pop-up.<br>
   **OR**<br>
   • Open Chrome and go to `chrome://extensions/`.<br>
   • Click the **Reload** button to reload the extension.

---

## Usage

1. **Auto-Login**:
   - Navigate to the AIUB portal login page.
   - Ensure the auto-login feature is enabled in the settings.
   - The extension will automatically fill in credentials and solve captchas.

2. **Unlocked Courses**:
   - Navigate to the "Unlocked Courses" section in the extension.
   - Reload the page to fetch the latest data.

3. **Exam Schedule**:
   - Navigate to the "Exam Schedule" section in the extension.
   - Reload the page to view the latest schedule.

4. **Settings**:
   - Open the "Settings" page in the extension.
   - Configure your auto-login preferences and API key.

---

## Configuration

### API Key for Captcha Solving
To enable captcha solving, you need an API key for the Gemini service. Add your API key in the settings page of the extension.

---

## File Structure
```
CourseChromeextaintion/
├── app/
│   ├── assets/
│   │   ├── js/
│   │   │   ├── main.js          # Main logic for the extension
│   │   │   ├── autologin.js     # Auto-login functionality
│   │   ├── json/                # JSON files for course and exam data
│   │   ├── icons/               # Extension icons
│   ├── pages/                   # HTML pages for the extension
├── background.js                # Background script for the extension
├── manifest.json                # Chrome extension manifest file
└── readme.md                    # Project documentation
```

---

## Permissions

The extension requires the following permissions:

- **`scripting`**: To inject scripts into the AIUB portal pages.
- **`tabs`**: To interact with the active browser tab.
- **`storage`**: To save and retrieve user settings.
- **`host_permissions`**: To access specific pages on the AIUB portal.

---

## Troubleshooting

1. **Auto-login not working**:
   - Ensure the API key is correctly configured in the settings.
   - Verify that the auto-login toggle is enabled.

2. **Data not loading**:
   - Check the console for errors (`Ctrl + Shift + J` in Chrome).
   - Ensure the required permissions are granted in the `manifest.json`.

3. **Extension not loading**:
   - Verify that the project folder is correctly loaded as an unpacked extension in Chrome.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue for any bugs or feature requests.
