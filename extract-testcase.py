from docx import Document
import re

doc = Document('C:\\Users\\sadurai\\Downloads\\EXOS Instant Port Functional Test Plan.docx')

# Find paragraphs with test case numbers
test_case_pattern = re.compile(r'^5\.\d+\.\d+')
collecting = False
test_case_content = []
count = 0

for i, p in enumerate(doc.paragraphs):
    text = p.text.strip()
    
    # Check if this is test case 5.1.1
    if test_case_pattern.match(text) and '5.1.1' in text:
        collecting = True
        count = 0
    
    if collecting:
        test_case_content.append(text)
        count += 1
        
        # Collect next 30 paragraphs or until next test case
        if count > 30 or (count > 3 and test_case_pattern.match(text) and '5.1.1' not in text):
            break

print('\n'.join(test_case_content))
