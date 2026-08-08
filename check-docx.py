import zipfile, xml.etree.ElementTree as ET

z = zipfile.ZipFile('/tmp/dl.docx')
doc = ET.parse(z.open('word/document.xml'))
ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
paras = doc.findall('.//' + ns + 'p')
texts = [''.join(p.itertext()) for p in paras]
# Find test case lines
tc_lines = [t for t in texts if any(x in t for x in ['5.1.1', '5.1.2', '5.2.1', '5.4.1', '5.5.1', '5.6.1'])]
print('Found test case sections in DOCX:')
for line in tc_lines[:10]:
    print(' -', line[:100].strip())

# Count non-empty paragraphs
non_empty = [t for t in texts if t.strip()]
print(f'\nTotal non-empty paragraphs: {len(non_empty)}')
