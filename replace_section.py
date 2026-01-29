#!/usr/bin/env python3
"""Script to replace the Nano Banana Input Images section in AIMediaGen.ts"""

# Read the original file
with open('nodes/AIMediaGen.ts', 'r') as f:
    lines = f.readlines()

# Find the start and end of the section to replace
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if '// Nano Banana - Input Images' in line and 'Nano Banana - Aspect Ratio' not in line:
        start_idx = i
    if start_idx is not None and '// Nano Banana - Aspect Ratio' in line:
        end_idx = i
        break

if start_idx is None or end_idx is None:
    print(f"Error: Could not find section. start_idx={start_idx}, end_idx={end_idx}")
    exit(1)

print(f"Found section from line {start_idx + 1} to {end_idx}")

# Generate the new 14 fields
new_fields = []
new_fields.append('\t\t// Nano Banana - Input Images (14 separate fields)\n')

ordinal_map = {
    1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth',
    5: 'Fifth', 6: 'Sixth', 7: 'Seventh', 8: 'Eighth',
    9: 'Ninth', 10: 'Tenth', 11: 'Eleventh', 12: 'Twelfth',
    13: 'Thirteenth', 14: 'Fourteenth'
}

for i in range(1, 15):
    field_template = f"""\t\t{{
\t\t\tdisplayName: 'Input Image {i}',
\t\t\tname: 'nbInputImage{i}',
\t\t\ttype: 'string',
\t\t\tdefault: '',
\t\t\tdisplayOptions: {{
\t\t\t\tshow: {{
\t\t\t\t\toperation: ['nanoBanana'],
\t\t\t\t}},
\t\t\t}},
\t\t\tplaceholder: 'Image URL, base64 data, or binary property name{" (e.g., data)" if i == 1 else ""}',
\t\t\tdescription: '{ordinal_map[i]} input image{" (Gemini 3 Pro)" if i >= 5 else ""}',
\t\t}},
"""
    new_fields.append(field_template)

# Build the new file content
new_content = lines[:start_idx] + new_fields + lines[end_idx:]

# Write the new file
with open('nodes/AIMediaGen.ts', 'w') as f:
    f.writelines(new_content)

print("Successfully replaced the Input Images section with 14 separate fields")
