from docx import Document

doc = Document('C:\\Users\\sadurai\\Downloads\\EXOS Instant Port Functional Test Plan.docx')

# Find test case 5.1.1
found = False
lines = []
for i, p in enumerate(doc.paragraphs):
    text = p.text.strip()
    if '5.1.1' in text and 'traffic behavior' in text:
        found = True
    
    if found:
        lines.append(text)
        # Stop at next test case
        if len(lines) > 1 and (text.startswith('5.1.2') or text.startswith('5.2.')):
            break

print('\n'.join(lines[:50]))  # First 50 lines
