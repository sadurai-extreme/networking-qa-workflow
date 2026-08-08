import zipfile, xml.etree.ElementTree as ET

# Check Excel
z = zipfile.ZipFile('/tmp/dl.xlsx')
tree = ET.parse(z.open('xl/worksheets/sheet1.xml'))
ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
rows = tree.findall('.//' + ns + 'row')
print('Excel total rows:', len(rows))
print('Test case rows (excl header):', len(rows) - 1)

# Get shared strings for cell content
strings = []
try:
    st = ET.parse(z.open('xl/sharedStrings.xml'))
    strings = [si.find('.//' + ns + 't').text or '' for si in st.findall('.//' + ns + 'si')]
except:
    pass

# Show first 5 test case titles (column C = index 2, after Project and Suite)
print('\nFirst 5 test cases:')
count = 0
for row in rows[1:6]:
    cells = row.findall(ns + 'c')
    for c in cells:
        ref = c.get('r', '')
        if ref.startswith('C'):
            t = c.find(ns + 'v')
            if t is not None and c.get('t') == 's':
                print(' -', strings[int(t.text)])
            elif t is not None:
                print(' -', t.text)
