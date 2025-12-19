import json
import os
import zipfile
import subprocess
import shutil
import sys
import argparse

def clean_html(text):
    if not text:
        return ""
    return str(text).replace('\t', ' ').replace('\n', '<br>')

def extract_filename(url):
    return os.path.basename(url)

def process_noji_ofc(input_path, output_dir):
    """
    Processes a Noji .ofc file OR an already extracted folder.
    """
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    # 1. Setup output directories
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    anki_attachments_dir = os.path.join(output_dir, "attachments")
    if not os.path.exists(anki_attachments_dir):
        os.makedirs(anki_attachments_dir)

    temp_dir = None
    work_dir = input_path

    try:
        # 2. If it's a file, unzip to temp
        if os.path.isfile(input_path):
            temp_dir = os.path.join(output_dir, "temp_work")
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            os.makedirs(temp_dir)
            print(f"Unzipping {input_path}...")
            with zipfile.ZipFile(input_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            work_dir = temp_dir

        # 3. Find deck_export_data or deck_data.json (Recursive search)
        export_data_path = None
        json_path = None
        attachments_zip = None

        for root, dirs, files in os.walk(work_dir):
            if 'deck_data.json' in files:
                json_path = os.path.join(root, 'deck_data.json')
            if 'deck_export_data' in files:
                export_data_path = os.path.join(root, 'deck_export_data')
            if 'attachments.zip' in files:
                attachments_zip = os.path.join(root, 'attachments.zip')
        
        # Determine actual work directory based on where files were found
        if json_path:
            work_dir = os.path.dirname(json_path)
            print(f"Found deck_data.json in {work_dir}")
        elif export_data_path:
            work_dir = os.path.dirname(export_data_path)
            print(f"Found deck_export_data in {work_dir}")
            json_path = os.path.join(work_dir, 'deck_data.json')
            print("Decompressing deck data...")
            subprocess.run(['zstd', '-d', export_data_path, '-o', json_path], check=True)
        else:
            print("Error: Could not find deck_export_data or deck_data.json in the provided path.")
            return

        # 4. Extract/Merge attachments
        # Re-check attachments_zip in the folder where data was found
        if not attachments_zip:
             attachments_zip = os.path.join(work_dir, 'attachments.zip')

        if os.path.exists(attachments_zip):
            print("Extracting/Merging attachments...")
            with zipfile.ZipFile(attachments_zip, 'r') as zip_ref:
                zip_ref.extractall(anki_attachments_dir)
        
        # 5. Generate Anki TSV
        print("Generating Anki import file...")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)


        deck_map = {deck['id']: deck['name'] for deck in data}

        def get_full_deck_name(deck):
            ancestry = deck.get('ancestry', '/')
            parts = ancestry.strip('/').split('/')
            path_names = []
            for p_id in parts:
                if p_id and p_id.isdigit() and int(p_id) in deck_map:
                    path_names.append(deck_map[int(p_id)])
            path_names.append(deck['name'])
            return "::".join(path_names)

        output_rows = []
        for deck in data:
            full_name = get_full_deck_name(deck)
            for note in deck.get('notes', []):
                fields = note.get('fields', {})
                front = clean_html(fields.get('front_side', ''))
                back = clean_html(fields.get('back_side', ''))
                
                # Attachments
                for att_wrapper in note.get('note_attachments', []):
                    field_name = att_wrapper.get('field_name')
                    url = att_wrapper.get('attachment', {}).get('media_file', {}).get('url')
                    if url:
                        filename = extract_filename(url)
                        img_tag = f'<img src="{filename}">'
                        if field_name == 'front_side':
                            front += f"<br>{img_tag}"
                        else:
                            back += f"<br>{img_tag}"
                
                output_rows.append(f"{front}\t{back}\t{full_name}")

        base_name = os.path.basename(input_path.rstrip('/'))
        anki_file_path = os.path.join(output_dir, f"anki_import_{base_name}.txt")
        
        with open(anki_file_path, 'w', encoding='utf-8') as f:
            f.write("#separator:tab\n#html:true\n#deck column:3\n")
            for row in output_rows:
                f.write(row + '\n')

        print(f"\nSuccess!")
        print(f"Anki file: {anki_file_path}")
        print(f"Attachments: {anki_attachments_dir}")
        print(f"Total cards: {len(output_rows)}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Noji .ofc (file or folder) to Anki import.")
    parser.add_argument("input", help="Path to the .ofc file or extracted folder")
    parser.add_argument("--output", help="Directory for the results (defaults to anki_<input_name>)")
    
    args = parser.parse_args()
    
    # Auto-generate output folder name if not provided
    if not args.output:
        base = os.path.basename(args.input.rstrip('/'))
        if '.' in base:
            base = os.path.splitext(base)[0]
        args.output = f"anki_{base}"

    process_noji_ofc(args.input, args.output)


