# Noji to Anki Converter

Convert Noji `.ofc` export files into Anki-ready `.txt` import files with full image support and sub-deck hierarchy.

> 🌐 **Easiest way: use the website at [nojitoanki.com](https://nojitoanki.com).** Nothing to install, and your deck never leaves your computer. The steps below are for running the converter yourself with Python.

⏱️ **Time needed:** about 5–10 minutes, even if you've never used a terminal before.

> 💡 **Not a tech person? No problem!**
> You can copy this entire README and paste it into an AI assistant like **ChatGPT**, **Claude**, or **Gemini**. Then tell it something like:
> *"I want to convert my Noji deck to Anki using these instructions. I'm on [Mac/Windows/Linux]. Please guide me step by step."*
> It will walk you through every step, and you can ask it questions whenever you get stuck.

## 🛠 Prerequisites

All you need is **Python 3.14 or newer**. That's it.

### 🐍 Installing Python
First, check whether a recent Python is already installed. Open a terminal (macOS: **Terminal**, Windows: **Command Prompt** or **PowerShell**) and run:
```bash
python3 --version
```
If you see `Python 3.14` or higher (for example `Python 3.14.2`), you're all set and can skip to [Usage](#-usage). If you see an older version (like `3.12`) or an error, install the latest version:

*   **macOS**:
    - Option A (easiest): Download the installer from [python.org/downloads](https://www.python.org/downloads/) and run it.
    - Option B (with [Homebrew](https://brew.sh)): Open Terminal and run:
      ```bash
      brew install python
      ```
*   **Windows**:
    1.  Download the installer from [python.org/downloads](https://www.python.org/downloads/).
    2.  Run it and **check the box "Add python.exe to PATH"** at the bottom of the first screen (important!).
    3.  Click **Install Now**.
    4.  Close and reopen your terminal, then check with:
        ```bash
        python --version
        ```
    *(Note: On Windows the command is often `python` instead of `python3`. If `python3` doesn't work in the steps below, use `python`.)*
*   **Linux** (Debian/Ubuntu):
    ```bash
    sudo apt update
    sudo apt install python3
    ```
    Many Linux versions still ship an older Python. If yours is older than 3.14, see the note below.

### ⚙️ Using an older Python (3.13 or below)
Noji compresses its deck data with Zstandard (`zstd`). Python 3.14+ can unpack this on its own. Older versions need one extra thing. Pick **one** of these:

*   **Option A:** install the `zstandard` package for Python:
    ```bash
    python3 -m pip install zstandard
    ```
*   **Option B:** install the `zstd` tool:
    - **macOS**: `brew install zstd`
    - **Windows**: download `zstd.exe` from the [official Zstandard releases](https://github.com/facebook/zstd/releases), or run `scoop install zstd` or `choco install zstd`.
    - **Linux**: `sudo apt install zstd`

## 🚀 Usage

1.  Place your `.ofc` file (or the extracted folder) in this directory.
2.  Run the converter:
    ```bash
    python3 noji_to_anki.py "your_deck_name.ofc"
    ```
    (don't forget the quotes "" around the filename!)
3.  A new folder named `anki_your_deck_name` will be created.

### Optional: Add a label to every card
**Most people can skip this step.** The converter above is all you need.

`prepend_label.py` is a separate helper script that only runs if you start it yourself. It adds the same text to the start of the front side of every card. This is handy if you study cards from several subjects mixed together and want to see at a glance which subject a card belongs to:

| Before | After |
|---|---|
| What is ownership? | **Sachenrecht:** What is ownership? |

To use it, run it **after** the converter and give it two things: the `.txt` file the converter created (inside the `anki_...` folder) and the label you want:
```bash
python3 prepend_label.py "anki_your_deck_name/anki_import_your_deck_name.txt" "Sachenrecht: "
```
*   Do this **before** importing the file into Anki.
*   Put a space at the end of the label (`"Sachenrecht: "`), so it doesn't stick to the card text.
*   Running it twice won't add the label twice.

## 📥 Importing into Anki

### 1. Import the Cards
1.  Open Anki.
2.  Go to **File > Import**.
3.  Select the `.txt` file found inside the `anki_...` folder.
4.  Ensure **"Allow HTML in fields"** is checked.
5.  Anki will automatically create the decks and sub-decks for you.

### 2. Move the Media (Images)
For images to display, you must move the contents of the `attachments` folder into Anki's internal media folder:

*   **macOS**:
    1.  Copy all files inside the `attachments` folder.
    2.  Go to: `~/Library/Application Support/Anki2/User 1/collection.media`
    3.  Paste the files there.
    *(Note: Replace "User 1" with your Anki profile name if different)*.

*   **Windows**:
    1.  Copy all files inside the `attachments` folder.
    2.  Press `Win + R`, type `%APPDATA%`, and hit Enter.
    3.  Navigate to: `Anki2\User 1\collection.media`
    4.  Paste the files there.

## 🩹 Troubleshooting

### Images show up as a broken picture icon in Anki

*   At the end, the script prints `Images: X of Y ready`. If some are missing, it downloads them from Noji automatically (this needs an internet connection). Images that still fail are listed in a warning.
*   Make sure you copied the files from the `attachments` folder that the script created. Each card points to a file name like `c4915ef6-44f7-468f-8c82-eff8ba8a41a5.jpg`, and that exact file must be in `collection.media`. Files with other names (for example `409095344.jpg`) come from a different import and won't work for these cards.

## 📁 Repository Structure
*   `noji_to_anki.py`: The main conversion script.
*   `prepend_label.py`: Optional helper that adds a label to the front of every card.
*   `README.md`: This instruction guide.

## ❗️Tipps❗️
If you are finding all those steps too complex, remember: you can paste this whole README into ChatGPT, Claude, or Gemini and ask it to guide you (see the note at the top).

If there is any issue, feel free to contact me at: nickeliaswerner@gmail.com
