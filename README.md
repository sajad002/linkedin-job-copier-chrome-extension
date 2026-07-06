# LinkedIn Job Copier

A small Chrome Manifest V3 extension for copying LinkedIn Jobs data into GPT.

## What it does

- **Copy positions list**: copies the visible job cards from the LinkedIn Jobs results pane.
- **Copy open position info**: copies highlighted/selected text if you selected text on the page; otherwise it extracts the currently open job details from the right pane.
- Optional checkbox: adds a ready-to-use GPT prompt above the copied data.

## Install locally

1. Unzip the extension folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped `linkedin-job-copier` folder.
6. Open or reload a LinkedIn Jobs page.
7. Pin the extension and use the two copy buttons.

## Notes

LinkedIn changes its page structure often. This extension uses robust fallback selectors, but if copying stops working, update `content.js` selectors or select the exact text on the page before clicking **Copy open position info**.
