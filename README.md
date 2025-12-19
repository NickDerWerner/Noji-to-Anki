# Noji to Anki Converter

Convert Noji `.ofc` export files into Anki-ready `.txt` import files with full image support and sub-deck hierarchy.

## 🛠 Prerequisites

This script requires **Python 3** and the **`zstd`** compression tool.

### ⚙️ Installing `zstd`
The Noji data is compressed using Zstandard (`zstd`). You must install this tool for the script to work:

*   **macOS**: Open Terminal and run:
    ```bash
    brew install zstd
    ```
*   **Windows**:
    - Download the `zstd.exe` from the [official Zstandard releases](https://github.com/facebook/zstd/releases).
    - Or use a package manager: `scoop install zstd` or `choco install zstd`.
*   **Linux**:
    ```bash
    sudo apt install zstd
    ```

## 🚀 Usage

1.  Place your `.ofc` file (or the extracted folder) in this directory.
2.  Run the converter:
    ```bash
    python3 noji_to_anki.py "your_deck_name.ofc"
    ```
3.  A new folder named `anki_your_deck_name` will be created.

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

## 📁 Repository Structure
*   `noji_to_anki.py`: The main conversion script.
*   `README.md`: This instruction guide.
