from docx import Document
import re

doc = Document('C:\\sadurai\\Working Folder\\FA Attach\\EXOS-FabricAttach-MLAG Functional_Test_Plan(1).docx')

# Find the first detailed test case (5.2.1.1 or similar)
test_pattern = re.compile(r'^5\.\d+\.\d+\.\d+')

found_idx = -1
for i, p in enumerate(doc.paragraphs):
    if test_pattern.match(p.text.strip()):
        found_idx = i
        print(f"Found first detailed test case at paragraph {i}")
        print(f"Test case: {p.text.strip()}\n")
        break

if found_idx > 0:
    print("=" * 80)
    print("Test case content (next 30 paragraphs):")
    print("=" * 80)
    for i in range(found_idx, min(found_idx + 30, len(doc.paragraphs))):
        text = doc.paragraphs[i].text.strip()
        if text:
            print(text)
            print()
        # Stop at next test case
        if i > found_idx and test_pattern.match(text):
            print("\\n[Next test case found, stopping]")
            break
