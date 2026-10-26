# Sync

Navill can sync your bookmarks and settings to **Google Drive** or your own **WebDAV** server. Pick one in Settings → Sync.

## Google Drive

Navill stores its data in Drive's hidden app folder (`appDataFolder`). It doesn't show up in your Drive file list, and Navill can't see your other files: it only asks for the `drive.appdata` scope.

## WebDAV

Enter the server address, username and an app password. Data goes into `navill-bookmarks/` at the server root. The password stays on this device and never syncs. Navill asks for permission to reach that server when you connect.

## How it works

- Everything reads and writes locally first, so the page never waits for the network.
- Changes queue up and upload in a batch every 15 minutes by default (5, 15, 60 minutes, or manual only). ⌘S / Ctrl+S syncs right away.
- Before uploading, Navill pulls and merges changes from other devices; newer edits win per item.
- If sync fails, Settings → Sync shows the HTTP status with an explanation, such as "401 Unauthorized", and retries after 1, 5 and 15 minutes.
- Per-device choices don't sync: current mode, last workspace, and the sync switch itself.
- Logs are optional: turn on log sync to see changes from all devices.

You can sign out or delete the cloud data in Settings → Sync.
