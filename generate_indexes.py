import os
import json
from pathlib import Path

# Get the image directory
image_dir = Path(__file__).parent / "image"

# Valid media extensions
MEDIA_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.mp4', '.webm', '.mov', '.avi'}

# Scan all project folders
for project_folder in image_dir.iterdir():
    if not project_folder.is_dir():
        continue
    
    # Get all media files in this project
    media_files = []
    for file in sorted(project_folder.iterdir()):
        if file.is_file() and file.suffix.lower() in MEDIA_EXTENSIONS:
            media_files.append(file.name)
    
    # Create index.json with the list
    if media_files:
        index_path = project_folder / "index.json"
        with open(index_path, 'w') as f:
            json.dump({"media": media_files}, f, indent=2)
        print(f"✓ Created {project_folder.name}/index.json with {len(media_files)} files: {media_files}")
    else:
        print(f"✗ No media files found in {project_folder.name}")

print("\nDone! All project folders now have index.json files.")
