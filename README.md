# Timesheeter

A desktop app for recording your time against Dynamics 365 Project Operations projects/tasks throughout the day, then reviewing and uploading it.

## For Users

### Getting started

On first launch, the app opens a browser tab for you to log in with your Dynamics 365 (Microsoft) account. Until that login completes, the app window just shows a prompt to finish logging in there. Once login succeeds, the app switches to the Home screen automatically — no need to restart it. On subsequent launches your login details will be cached

Tips:

* The overall philosophy is that you tell timesheeter *every time you change what you are doing*, however often that is. Before uploading the data to dynamics it will aggregate and round the entries.
* Windows key + Ctrl + T brings the app window to the front from anywhere, even if it's minimized.
* A lot of attention has been given to making the application work well with keyboard only: tab order is sensible, up and down cursor arrows generally do what you would expect them to, dropdowns are all searchable with up/down and enter to select the entry that you want.

### Home screen

Two options:

* **Record Time** — log what you're working on as you go through the day.
* **Edit and Upload Entries** — review a day's recorded entries, adjust them, and upload the final numbers to Dynamics.

### Record time

Each time you record an entry you're filling in two things: a time range, and what the work was.

1. **Time**
* **Start** — defaults to the end of your last entry that day (so entries chain together with no gaps). If there's no entry yet, defaults to the start of your day (08:00). You can override with a custom time.
* **End** — defaults to "now", or pick a custom time.
2. **Work** — one of:
* **Recent** — pick from your 10 most recently used project/task/qualifier combinations (across all days, not just today).
* **Custom** — pick a project and task from Dynamics, plus an optional free-text qualifier (e.g. a ticket number or short description). Qualifier suggestions from anything you've used against that project/task in the last two weeks show up as you type.
* **Split** — for time you can't attribute to one thing. Split time doesn't get a project/task of its own; instead, when you later review the day (see below), it gets divided proportionally across whatever real work you logged that day.

Hit **Record** to save the entry (or **Clear** to reset the form). You can keep recording entries throughout the day — each new entry defaults to starting where the last one left off. **Exit** (or `Esc`) returns to the Home screen.
There is **no undo**, and no easy way to see the entries you have already logged, other than to run the PowerShell script (see *Data Storage* below) or go to the **Edit and Upload Entries** screen.

Once a day has been uploaded to dynamics, you can no longer record new entries against it — the Recording screen will tell you if you try.

### Edit and Upload Entries

From **Edit and Upload Entries**, pick a day (only days with recorded, not-yet-uploaded entries are listed) to see it grouped by project/task/qualifier:

* **Split** time has already been spread across the other rows proportionally, and everything is rounded to the nearest 15 minutes.
* Each row's "Logged" column shows the exact time you actually recorded, for reference — it never changes.
* Use the **-** / **+** buttons to nudge a row by 15 minutes (arrow keys move between rows/buttons once a control is focused).
* Edit the **qualifier** text directly if needed.

When the numbers look right, click **Upload to Dynamics** to submit the day's entries. Once uploaded, the day is locked — it disappears from the edit list and can no longer be recorded against or re-uploaded. **Exit** (or `Esc`) discards any in-progress edits on this screen and asks for confirmation first.

### Data storage

Recorded entries are stored locally as JSON files (one per day) in the app's user data folder (%APPDATA%\\timesheeter\\recorded) — nothing is sent to Dynamics until you explicitly upload a day. To see a list of your entries for the most recently recorded day (which will normally be today) you can run the PowerShell script most-recent-day-timesheet.ps1



## For Developers

To setup and launch:

```
npm install
npm start
```

