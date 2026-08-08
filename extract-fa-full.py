from docx import Document

doc = Document('C:\\sadurai\\Working Folder\\FA Attach\\EXOS-FabricAttach-MLAG Functional_Test_Plan(1).docx')

# Extract test case starting at paragraph 520 (before "Topology used:")
print("=" * 80)
print("Test Case Format from FA Attach MLAG Test Plan")
print("=" * 80)
print()

for i in range(520, 560):
    text = doc.paragraphs[i].text.strip()
    if text:
        print(text)
    else:
        print("[EMPTY LINE]")
