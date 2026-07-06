# LinkedIn Job Copier

A small Chrome Manifest V3 extension for copying LinkedIn Jobs data into GPT.

## What it does

- **Copy positions list**: copies the visible job cards from the LinkedIn Jobs results pane.
- **Copy open position info**: clicks LinkedIn's `… more` / `Show more` button first, then copies the expanded open job details from the right pane.
- If you manually highlight text on the page first, **Copy open position info** copies that selected text exactly.
- Optional checkbox: adds a ready-to-use GPT prompt above the copied data.

## Install locally

1. Unzip the extension folder.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped `linkedin-job-copier` folder.
6. Open or reload a LinkedIn Jobs page.
7. Pin the extension and use the two copy buttons.

## Updating from an older version

1. Unzip this new package.
2. In `chrome://extensions`, either remove the old LinkedIn Job Copier and load this folder again, or click **Reload** on the existing unpacked extension after replacing the files.
3. Reload the LinkedIn Jobs tab.

## Notes

LinkedIn changes its page structure often. Version 1.1.0 adds more fallback selectors and geometry-based extraction for the left job list. If LinkedIn changes again, selecting the exact text on the page before clicking **Copy open position info** still works as a fallback for the details pane.
