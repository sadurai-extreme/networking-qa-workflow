from docx import Document
import re

doc = Document('C:\\sadurai\\Working Folder\\FA Attach\\EXOS-FabricAttach-MLAG Functional_Test_Plan(1).docx')

# Find test case 5.2.1.1 and extract its content
collecting = False
test_case_content = []
count = 0

for i, p in enumerate(doc.paragraphs):
    text = p.text.strip()
    
    # Start collecting at test case 5.2.1.1
    if '5.2.1.1' in text and 'Verify MLAG proxy' in text:
        collecting = True
        count = 0
        print(f"Found test case at paragraph {i}\n")
    
    if collecting:
        test_case_content.append(text if text else '[EMPTY LINE]')
        count += 1
        
        # Stop at next test case 5.2.1.2
        if count > 5 and '5.2.1.2' in text:
            break

print('\n'.join(test_case_content[:50]))
