# RetroRADtv Version 3

Based on GitHub backup RatroRADtv_ver-2.0_GitHub_2026-11-07_11-12-29_IST, commit fa631feebbb0cd7ccabb15ab4290cb35fb5a3789.

Radio and TV each support 50 saved presets. The limits apply to initial loading, adding favorites, preset pages, carousels and remote quick presets. Recent history and online search results are not saved presets and retain their separate limits. Previous saved selections are imported into separate v3 preset storage; overflow is preserved in browser storage before limiting to 50.

Admin HTML, scripts, seven-tap activation and admin link are removed from this distribution. Edit data/radio-presets.json, data/tv-presets.json and data/app-settings.json locally and publish with GitHub Desktop.

Upload the contents of this folder, including data. If replacing an existing deployed app, also delete old admin.html, admin.js and admin-entry.js from the repository: uploading new files alone does not remove old files. No desktop OAuth app is required.

JavaScript syntax and source assertions passed. Browser/device playback verification remains required. Version 2 and its backup are unchanged.
