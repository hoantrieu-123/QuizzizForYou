"""
Word (.docx) XML Parser
Extracts text, paragraphs, tables, runs, and specifically run-level highlights (<w:highlight w:val="..."/>).
"""
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'v': 'urn:schemas-microsoft-com:vml',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'w10': 'urn:schemas-microsoft-com:office:word',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
}

VALID_HIGHLIGHT_COLORS = {
    'yellow', 'green', 'cyan', 'magenta', 'blue', 'red',
    'darkblue', 'darkred', 'darkgreen', 'darkyellow', 'darkmagenta', 'darkcyan',
    'lightgray', 'darkgray', 'black'
}


def parse_run(r_elem: ET.Element) -> Dict[str, Any]:
    """Parse a single <w:r> element and return text, highlight info, and style."""
    rPr = r_elem.find('w:rPr', NS)
    highlight_color = None
    is_highlighted = False
    bold = False
    italic = False
    underline = False

    if rPr is not None:
        # Check <w:highlight w:val="..."/>
        hl = rPr.find('w:highlight', NS)
        if hl is not None:
            val = hl.attrib.get(f'{{{NS["w"]}}}val') or hl.attrib.get('val', '')
            if val and val.lower() != 'none':
                is_highlighted = True
                highlight_color = val.lower()

        # Also check <w:shd w:fill="..."/> as fallback if no w:highlight
        if not is_highlighted:
            shd = rPr.find('w:shd', NS)
            if shd is not None:
                fill = shd.attrib.get(f'{{{NS["w"]}}}fill') or shd.attrib.get('fill', '')
                if fill and fill.lower() not in ('auto', 'none', 'ffffff', '000000'):
                    is_highlighted = True
                    highlight_color = f"hex:{fill.lower()}"

        # Bold
        b_elem = rPr.find('w:b', NS)
        if b_elem is not None:
            b_val = b_elem.attrib.get(f'{{{NS["w"]}}}val') or b_elem.attrib.get('val', 'true')
            bold = b_val not in ('0', 'false', 'none')

        # Italic
        i_elem = rPr.find('w:i', NS)
        if i_elem is not None:
            i_val = i_elem.attrib.get(f'{{{NS["w"]}}}val') or i_elem.attrib.get('val', 'true')
            italic = i_val not in ('0', 'false', 'none')

        # Underline
        u_elem = rPr.find('w:u', NS)
        if u_elem is not None:
            u_val = u_elem.attrib.get(f'{{{NS["w"]}}}val') or u_elem.attrib.get('val', 'single')
            underline = u_val not in ('none', '0', 'false')

    # Gather text inside <w:t>
    text_pieces = []
    for t in r_elem.findall('.//w:t', NS):
        if t.text:
            text_pieces.append(t.text)
    # Also handle <w:tab/> as tab or space
    for _ in r_elem.findall('.//w:tab', NS):
        text_pieces.append('\t')
    # Also handle <w:br/> as newline
    for _ in r_elem.findall('.//w:br', NS):
        text_pieces.append('\n')

    text = ''.join(text_pieces)

    return {
        'text': text,
        'is_highlighted': is_highlighted,
        'highlight_color': highlight_color,
        'bold': bold,
        'italic': italic,
        'underline': underline,
    }


def parse_paragraph(p_elem: ET.Element) -> Dict[str, Any]:
    """Parse a <w:p> element into text, runs, and highlight summary."""
    runs = []
    full_text_pieces = []
    has_highlight = False
    highlighted_runs_text = []
    highlight_colors = set()

    for child in p_elem:
        tag = child.tag.split('}')[-1]
        if tag == 'r':
            run_data = parse_run(child)
            runs.append(run_data)
            full_text_pieces.append(run_data['text'])
            if run_data['is_highlighted']:
                has_highlight = True
                highlighted_runs_text.append(run_data['text'])
                if run_data['highlight_color']:
                    highlight_colors.add(run_data['highlight_color'])
        elif tag == 'hyperlink':
            # Handle hyperlinks which contain runs
            for sub_r in child.findall('.//w:r', NS):
                run_data = parse_run(sub_r)
                runs.append(run_data)
                full_text_pieces.append(run_data['text'])
                if run_data['is_highlighted']:
                    has_highlight = True
                    highlighted_runs_text.append(run_data['text'])
                    if run_data['highlight_color']:
                        highlight_colors.add(run_data['highlight_color'])

    full_text = ''.join(full_text_pieces).strip()
    highlighted_text = ''.join(highlighted_runs_text).strip()

    return {
        'type': 'paragraph',
        'text': full_text,
        'runs': runs,
        'has_highlight': has_highlight,
        'highlighted_text': highlighted_text,
        'highlight_colors': list(highlight_colors),
    }


def parse_table(tbl_elem: ET.Element) -> Dict[str, Any]:
    """Parse a <w:tbl> element into rows and cells with paragraph and run information."""
    rows = []
    for tr in tbl_elem.findall('w:tr', NS):
        cells = []
        for tc in tr.findall('w:tc', NS):
            # Check cell shading
            tc_has_highlight = False
            tc_shd_color = None
            tcPr = tc.find('w:tcPr', NS)
            if tcPr is not None:
                shd = tcPr.find('w:shd', NS)
                if shd is not None:
                    fill = shd.attrib.get(f'{{{NS["w"]}}}fill') or shd.attrib.get('fill', '')
                    if fill and fill.lower() not in ('auto', 'none', 'ffffff', '000000'):
                        tc_has_highlight = True
                        tc_shd_color = f"hex:{fill.lower()}"

            cell_paragraphs = []
            cell_texts = []
            cell_has_hl = tc_has_highlight
            cell_hl_text = []
            cell_colors = set()
            if tc_shd_color:
                cell_colors.add(tc_shd_color)

            for p in tc.findall('w:p', NS):
                p_data = parse_paragraph(p)
                cell_paragraphs.append(p_data)
                if p_data['text']:
                    cell_texts.append(p_data['text'])
                if p_data['has_highlight']:
                    cell_has_hl = True
                    cell_hl_text.append(p_data['highlighted_text'])
                    cell_colors.update(p_data['highlight_colors'])

            full_cell_text = ' '.join(cell_texts).strip()

            # If cell has background shading, entire cell text is highlighted
            if tc_has_highlight and not cell_hl_text:
                cell_hl_text.append(full_cell_text)

            cells.append({
                'text': full_cell_text,
                'paragraphs': cell_paragraphs,
                'has_highlight': cell_has_hl,
                'highlighted_text': ' '.join(cell_hl_text).strip(),
                'highlight_colors': list(cell_colors)
            })
        rows.append(cells)

    return {
        'type': 'table',
        'rows': rows,
        'row_count': len(rows),
        'col_count': max([len(r) for r in rows]) if rows else 0
    }


def parse_docx_bytes(docx_bytes: bytes) -> List[Dict[str, Any]]:
    """Parse a .docx file from bytes into a sequential list of paragraphs and tables."""
    import io
    with zipfile.ZipFile(io.BytesIO(docx_bytes), 'r') as z:
        xml_content = z.read('word/document.xml')
    return parse_document_xml(xml_content)


def parse_docx_file(file_path: str) -> List[Dict[str, Any]]:
    """Parse a .docx file from disk path into a sequential list of paragraphs and tables."""
    with zipfile.ZipFile(file_path, 'r') as z:
        xml_content = z.read('word/document.xml')
    return parse_document_xml(xml_content)


def parse_document_xml(xml_content: bytes) -> List[Dict[str, Any]]:
    """Parse raw word/document.xml into block elements."""
    root = ET.fromstring(xml_content)
    body = root.find('w:body', NS)
    if body is None:
        return []

    elements = []
    for child in body:
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            p_data = parse_paragraph(child)
            # Only append non-empty paragraphs or paragraphs with highlight
            if p_data['text'] or p_data['has_highlight']:
                elements.append(p_data)
        elif tag == 'tbl':
            tbl_data = parse_table(child)
            if tbl_data['rows']:
                elements.append(tbl_data)

    return elements

