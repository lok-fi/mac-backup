import pandas as pd
import sys
import base64
import io
from fpdf import FPDF, enums

def excel_to_pdf(base64_str):
    # Decode Excel from Node.js
    try:
        excel_data = base64.b64decode(base64_str)
        xl = pd.ExcelFile(io.BytesIO(excel_data))
        
        # Use Landscape (L) to give us more width
        pdf = FPDF(orientation='L', unit='mm', format='A4')
        pdf.set_auto_page_break(auto=True, margin=10)
        
        for sheet_name in xl.sheet_names:
            df = xl.parse(sheet_name).fillna('')
            pdf.add_page()
            
            # Title
            pdf.set_font("helvetica", 'B', 12)
            pdf.cell(0, 10, f"Sheet: {sheet_name}", align='C', new_x="LMARGIN", new_y="NEXT")
            
            # Table Content - Tiny font to prevent the "No space" error
            pdf.set_font("helvetica", size=6)
            
            for i, row in df.iterrows():
                # Clean the data to avoid encoding issues
                line = " | ".join([str(val).replace('\n', ' ').strip() for val in row.values])
                # multi_cell with a defined height and width
                pdf.multi_cell(0, 4, line, border=0, align='L', new_x="LMARGIN", new_y="NEXT")
                
        return pdf.output()
    except Exception as e:
        # If it fails, print the error so Node.js can see it
        sys.stderr.write(str(e))
        return b""

if __name__ == "__main__":
    # Read base64 string from Node.js stdin
    input_data = sys.stdin.read()
    if input_data:
        pdf_bytes = excel_to_pdf(input_data)
        if pdf_bytes:
            print(base64.b64encode(pdf_bytes).decode('utf-8'))