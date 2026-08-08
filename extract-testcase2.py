from docx import Document
import re

doc = Document('C:\\Users\\sadurai\\Downloads\\EXOS Instant Port Functional Test Plan.docx')

# Skip TOC - search after paragraph 300
test_case_pattern = re.compile(r'^5\.\d+\.\d+\s')
collecting = False
test_case_content = []
count = 0

for i, p in enumerate(doc.paragraphs):
    if i < 300:  # Skip TOC
        continue
        
    text = p.text.strip()
    
    # Check if this is test case 5.1.1
    if '5.1.1' in text and ('test' in text.lower() or 'To' in text):
        collecting = True
        count = 0
        print(f"Found test case at paragraph {i}")
    
    if collecting:
        test_case_content.append(text if text else '[EMPTY LINE]')
        count += 1
        
        # Collect next 40 paragraphs or until next major test case
        if count > 40 or (count > 5 and test_case_pattern.match(text) and '5.1.1' not in text):
            break

print('\n'.join(test_case_content[:60]))
