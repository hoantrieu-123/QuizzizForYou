"""
Sample Quiz Generator
Creates a standardized Word (.docx) file containing all 6 supported question types
with genuine run-level Word highlights (<w:highlight w:val="..."/>).
"""
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_COLOR_INDEX
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def add_highlight_to_run(run, color_val="yellow"):
    """Explicitly add <w:highlight w:val="..."/> to a run's XML."""
    rPr = run._r.get_or_add_rPr()
    # Remove existing highlight if any
    for child in list(rPr):
        if child.tag.endswith('highlight'):
            rPr.remove(child)
    hl = OxmlElement('w:highlight')
    hl.set(qn('w:val'), color_val)
    rPr.append(hl)


from backend.create_comprehensive_sample import create_comprehensive_docx

def create_sample_docx(output_path: str = "sample_quiz_highlighted.docx") -> str:
    return create_comprehensive_docx(output_path)


if __name__ == "__main__":
    path = create_sample_docx("sample_quiz_highlighted.docx")
    print(f"Generated sample file at: {path}")


