# Install

| Browser | Where |
| --- | --- |
| Chrome (and other Chromium browsers) | [Chrome Web Store](https://chromewebstore.google.com/detail/navill/lphobabkijoeabbjphfafflimnjgpdfb) |
| Microsoft Edge | Microsoft Edge Add-ons (search "Navill"), or install from the Chrome Web Store |
| Firefox 140+ | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/navill/) |

After installing, open a new tab. Navill takes over the new tab page and shows the welcome screen.

## Install a test build by hand

Every version, including alpha builds, is on [GitHub Releases](https://github.com/reiy-leo/navill/releases) as `navill-<version>-chrome.zip`, `-edge.zip` and `-firefox.zip`.

1. Download and unzip the package for your browser.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.

A hand-loaded build has a different extension ID from the store version, so the two keep separate data. Use [[Sync]] or [[Import and Export|Import-and-Export]] to move data between them.

## Firefox notes

- Firefox 140 or later is required.
- Firefox asks once for permission to read your bookmarks when you import.
- Firefox has no built-in favicon API, so site icons come from Google's icon service.
