GITHUB_TOKEN=your-new-token-with-models-permissionimport sys
from docx import Document

def extract_text_from_docx(docx_path):
    """Extract all text from a .docx file"""
    try:
        doc = Document(docx_path)
        full_text = []
        
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        
        # Also extract text from tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        full_text.append(cell.text)
        
        return '\n'.join(full_text)
    except Exception as e:
        return f"Error reading document: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python read-docx.py <path-to-docx>")
        sys.exit(1)
    
    docx_path = sys.argv[1]
    text = extract_text_from_docx(docx_path)
    print(text)
