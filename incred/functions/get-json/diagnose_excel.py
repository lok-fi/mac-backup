"""
Run this directly on your Excel file to see every sheet name,
every column header, and the first 3 data rows.

Usage:
    python3 diagnose_excel.py /path/to/your/file.xlsx
"""

import pandas as pd
import sys
import json

def diagnose(path):
    xl = pd.ExcelFile(path)
    print(f"\n{'='*60}")
    print(f"FILE: {path}")
    print(f"SHEETS ({len(xl.sheet_names)}): {xl.sheet_names}")
    print(f"{'='*60}\n")

    for name in xl.sheet_names:
        df = xl.parse(name, header=None)          # raw, no header assumption
        print(f"\n{'─'*60}")
        print(f"SHEET: \"{name}\"  ({df.shape[0]} rows × {df.shape[1]} cols)")
        print(f"{'─'*60}")

        # Print first 6 rows (row 0 is often header, rows 1-5 are data)
        for i, row in df.head(6).iterrows():
            values = [str(v) if pd.notna(v) else "—" for v in row]
            print(f"  row {i:2d}: {' | '.join(values)}")

        # Also print all unique non-null values in the first column
        first_col = df.iloc[:, 0].dropna().astype(str).unique().tolist()
        if first_col:
            print(f"\n  First-column unique values (first 20): {first_col[:20]}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 diagnose_excel.py <path_to_excel>")
        sys.exit(1)
    diagnose(sys.argv[1])
