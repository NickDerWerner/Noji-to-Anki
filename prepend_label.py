import os
import argparse

def prepend_label(file_path, label):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    temp_file = file_path + ".tmp"
    labeled = 0

    with open(file_path, 'r', encoding='utf-8') as fin, open(temp_file, 'w', encoding='utf-8') as fout:
        for line in fin:
            # Skip header lines
            if line.startswith('#'):
                fout.write(line)
                continue

            # Process data lines
            if '\t' in line:
                parts = line.split('\t')
                # Prepend label to the front side (first column), unless it's already there
                if not parts[0].startswith(label):
                    parts[0] = f"{label}{parts[0]}"
                    labeled += 1
                fout.write('\t'.join(parts))
            else:
                fout.write(line)

    # Replace original with modified
    os.replace(temp_file, file_path)
    print(f"Added '{label}' to {labeled} cards in {file_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add a label to the front side of every card in an Anki import file.")
    parser.add_argument("file", help="Path to the anki_import_....txt file created by noji_to_anki.py")
    parser.add_argument("label", help='Text to put in front of each card, e.g. "Sachenrecht: "')

    args = parser.parse_args()
    prepend_label(args.file, args.label)
