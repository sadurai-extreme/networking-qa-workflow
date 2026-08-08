from docx import Document
from docx.oxml.ns import qn
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'templates/reference_testplan.docx'
doc = Document(path)

print('=== STYLES USED ===')
styles_used = set()
for p in doc.paragraphs:
    if p.style.name:
        styles_used.add(p.style.name)
for t in doc.tables:
    for row in t.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                if p.style.name:
                    styles_used.add(p.style.name)
for s in sorted(styles_used):
    print(' ', s)

print()
print('=== DOCUMENT STRUCTURE ===')
for i, elem in enumerate(doc.element.body):
    tag = elem.tag.split('}')[-1]
    if tag == 'p':
        style_elem = elem.find(qn('w:pPr') + '/' + qn('w:pStyle'))
        style_name = style_elem.get(qn('w:val')) if style_elem is not None else 'Normal'
        text = ''.join(r.text for r in elem.findall('.//' + qn('w:t')))
        if text.strip():
            print('  [%s] %s' % (style_name, text[:120]))
    elif tag == 'tbl':
        rows = elem.findall('.//' + qn('w:tr'))
        cols_in_first = len(rows[0].findall(qn('w:tc'))) if rows else 0
        print('  [TABLE] %d rows x %d cols' % (len(rows), cols_in_first))
        for ri, row in enumerate(rows[:10]):
            cells = row.findall(qn('w:tc'))
            cell_texts = [''.join(r.text for r in c.findall('.//' + qn('w:t'))) for c in cells]
            sep = ' | '
            print('    row%d: %s' % (ri, sep.join(t[:35] for t in cell_texts[:6])))
        if len(rows) > 10:
            print('    ... (%d more rows)' % (len(rows) - 10))
