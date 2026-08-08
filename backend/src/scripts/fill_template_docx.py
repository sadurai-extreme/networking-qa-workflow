#!/usr/bin/env python3
"""
Fill the EXOS reference_testplan.docx template with test cases from a workflow.
Reads JSON payload from stdin, writes the populated DOCX to output_path.

Payload fields:
  title, jira_story, release, story_type, author, reviewer, approver,
  version, output_path, test_cases (list), template_path
"""
import sys, json, re, copy, datetime
from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from lxml import etree

# ─── helpers ─────────────────────────────────────────────────────────────────

def _hex_rgb(h):
    h = h.lstrip('#')
    return RGBColor(int(h[0:2],16), int(h[2:4],16), int(h[4:6],16))

def _set_cell_bg(cell, color_hex):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex.lstrip('#'))
    tcPr.append(shd)

def _para_text(para):
    """Return full text of a paragraph element (handles runs)."""
    return ''.join(
        r.text or '' for r in para.iter(qn('w:t'))
    )

def _elem_text(elem):
    """Return full visible text of any body element (p or tbl)."""
    return ''.join(t.text or '' for t in elem.iter(qn('w:t')))

def _split_lines(text):
    if not text:
        return []
    lines = []
    for raw in str(text).splitlines():
        line = raw.strip().lstrip('-').lstrip('\u2022').strip()
        line = re.sub(r'^[\d]+[\.\)]\s*', '', line).strip()
        if line and line not in ('-', ''):
            lines.append(line)
    return lines

# ─── TC section routing (matches reference template headings) ─────────────────

TC_SECTIONS = [
    ( 1, 'Conformance to Industry Standard',
         ['conformance','rfc','ieee','ietf','industry standard','protocol standard','comply']),
    ( 2, 'Feature Adherence to Functional Spec',
         []),   # default catch-all
    ( 3, 'Feature Adherence to PRD/MRD',
         ['prd','mrd','product requirement','business requirement']),
    ( 4, 'Feature Configuration - CLI & Network Mgmt Tool',
         ['cli','config','configuration','command','syntax','mgmt','management',
          'netconf','restconf','xml','snmp config','set command','show command']),
    ( 5, 'SNMP MIB Verification',
         ['snmp','mib','trap','oid','get-request','walk']),
    ( 6, 'Redundancy/Resiliency/Failover',
         ['redundan','resilien','failover','failback','reboot','restart','reload',
          'high availability','ha ','switchover','node failure','process restart',
          'save reboot','run failover','disable port all','enable port all']),
    ( 7, 'Feature Scaling & Feature Limit Testing',
         ['feature scal','feature limit','scaling','scale limit','maximum number',
          'max count','min count','boundary limit','feature boundary']),
    ( 8, 'Feature Performance',
         ['feature performance','throughput','latency','packet rate','pps',
          'bandwidth','forwarding rate','convergence time']),
    ( 9, 'Integrated Feature Scaling & Limit Testing',
         ['integrated scal','integrated limit','combined scal','interplay scal']),
    (10, 'Integrated Feature Performance',
         ['integrated performance','combined performance']),
    (11, 'Interoperability - Extreme & 3rd Party',
         ['interop','3rd party','third party','vendor','cross vendor','compatibility',
          'extreme interop','non-extreme']),
    (12, 'Diagnostic & Debug Testing',
         ['debug','diagnostic','syslog','log message','event log','show log',
          'tech support','decode','trace','packet capture']),
    (13, 'Usability Testing',
         ['usability','user interface','ease of use','user experience']),
    (14, 'Negative Testing',
         ['negative','invalid','error handling','invalid input','boundary','mismatch',
          'reject','deny','wrong','unsupported','out of range','duplicate']),
    (15, 'System Resource & Stress testing',
         ['stress','resource','memory','cpu','utilization','oom','out of memory',
          'cpu high','memory leak','system resource','load test']),
]

def _route_tc(tc):
    text = ((tc.get('title') or '') + ' ' + (tc.get('description') or '')).lower()
    for sec_num, _heading, keywords in TC_SECTIONS:
        if not keywords:
            continue
        if any(kw in text for kw in keywords):
            return sec_num
    return 2

# ─── Low-level XML helpers ────────────────────────────────────────────────────

def _make_para_elem(doc, text, style_name='Normal', bold=False, size_pt=10, color_hex=None):
    """Create a new <w:p> element with the given style and text."""
    p = doc.add_paragraph(style=style_name)
    p.clear()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size_pt)
    if color_hex:
        run.font.color.rgb = _hex_rgb(color_hex)
    # detach from body – we'll insert it manually
    doc.element.body.remove(p._p)
    return p._p

def _make_heading_elem(doc, text, level, size_pt, color_hex):
    style_map = {1: 'Heading 1', 2: 'Heading 2', 3: 'Heading 3', 4: 'Heading 4'}
    style_name = style_map.get(level, 'Heading 2')
    # Try to use the template's existing style
    p = doc.add_paragraph(style=style_name)
    p.clear()
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(size_pt)
    run.font.color.rgb = _hex_rgb(color_hex)
    doc.element.body.remove(p._p)
    return p._p

def _make_bullet_elem(doc, text):
    try:
        p = doc.add_paragraph(style='1Bullet')
    except Exception:
        p = doc.add_paragraph(style='List Bullet')
    p.clear()
    run = p.add_run(text)
    run.font.size = Pt(10)
    doc.element.body.remove(p._p)
    return p._p

def _make_label_value_elem(doc, label, value):
    """Bold label + normal value on same paragraph."""
    p = doc.add_paragraph(style='Normal')
    p.clear()
    r1 = p.add_run(label + ': ')
    r1.bold = True
    r1.font.size = Pt(10)
    r2 = p.add_run(value)
    r2.font.size = Pt(10)
    doc.element.body.remove(p._p)
    return p._p

def _insert_after(anchor_elem, new_elem):
    """Insert new_elem immediately after anchor_elem in the document body."""
    anchor_elem.addnext(new_elem)

def _insert_elems_after(anchor_elem, elems):
    """Insert a list of elements after anchor_elem (in order)."""
    prev = anchor_elem
    for e in elems:
        prev.addnext(e)
        prev = e

# ─── Core: update release info table ─────────────────────────────────────────

def _update_release_table(doc, jira_story, release, author, reviewer, approver, version):
    """Update Table 0 (Release Information) with workflow metadata."""
    if not doc.tables:
        return
    tbl = doc.tables[0]
    rows = tbl.rows
    def _set(row_idx, col_idx, text):
        if row_idx < len(rows) and col_idx < len(rows[row_idx].cells):
            cell = rows[row_idx].cells[col_idx]
            cell.paragraphs[0].clear()
            run = cell.paragraphs[0].add_run(str(text))
            run.font.size = Pt(10)

    # Row 0: header (skip)
    # Row 1: Release
    _set(1, 1, release)
    # Row 2: Feature Number / Jira Story
    if len(rows) > 2:
        rows[2].cells[0].paragraphs[0].clear()
        rows[2].cells[0].paragraphs[0].add_run('Jira Story').font.size == Pt(10)
        _set(2, 1, jira_story)
    # Row 3: Author
    if len(rows) > 3:
        rows[3].cells[0].paragraphs[0].clear()
        rows[3].cells[0].paragraphs[0].add_run('Author').font.size == Pt(10)
        _set(3, 1, author)
    # Row 4: Reviewer / Version
    if len(rows) > 4:
        rows[4].cells[0].paragraphs[0].clear()
        rows[4].cells[0].paragraphs[0].add_run('Reviewer').font.size == Pt(10)
        _set(4, 1, reviewer)
    # Add approver + version rows if space
    for cell in tbl.rows[0].cells:
        try:
            _set_cell_bg(cell, '#1D3557')
        except Exception:
            pass

# ─── Core: find heading element by matching text ──────────────────────────────

def _find_heading_elem(body_elems, text_fragment, partial=True):
    """Return (index, elem) of the first paragraph whose text contains text_fragment."""
    for i, elem in enumerate(body_elems):
        if elem.tag == qn('w:p'):
            t = _elem_text(elem)
            if partial and text_fragment.lower() in t.lower():
                return i, elem
            elif not partial and t.strip() == text_fragment.strip():
                return i, elem
    return None, None

# ─── Core: remove elements between two anchors ───────────────────────────────

def _remove_between(body, start_idx, end_idx):
    """Remove all body children at indices (start_idx, end_idx) exclusive."""
    elems = list(body)
    to_remove = elems[start_idx + 1 : end_idx]
    for e in to_remove:
        body.remove(e)

# ─── Core: build TC section XML blocks ───────────────────────────────────────

def _build_tc_blocks(doc, test_cases):
    """
    Return a list of lxml elements for the TC sections.
    Groups TCs by their routed section, produces:
      - Heading 2 for each section that has TCs
      - Heading 4 per TC title
      - Label+value rows for description / steps / expected
    """
    # Group by section
    from collections import defaultdict
    sec_map = defaultdict(list)
    for tc in test_cases:
        sec_num = _route_tc(tc)
        sec_map[sec_num].append(tc)

    SECTION_SIZES = {2: (14, '#1D3557'), 4: (11, '#003399')}

    elems = []

    for sec_num, sec_heading, _kw in TC_SECTIONS:
        tcs = sec_map.get(sec_num, [])

        # Build H2 heading element
        h2 = _make_heading_elem(doc, sec_heading, level=2, size_pt=12, color_hex='#1D3557')
        elems.append(h2)

        if not tcs:
            # Placeholder line
            ph = _make_para_elem(doc, 'No test cases in this section.', size_pt=10, color_hex='#888888')
            elems.append(ph)
            continue

        for tc in tcs:
            # TC heading
            tc_title = tc.get('title', f'TC-{tc.get("tc_number","?")}')
            h4 = _make_heading_elem(doc, tc_title, level=4, size_pt=11, color_hex='#003399')
            elems.append(h4)

            # TC number + classification
            meta_text = f'TC #: {tc.get("tc_number","")}    Classification: {tc.get("classification","")}'
            meta_p = _make_para_elem(doc, meta_text, bold=False, size_pt=9, color_hex='#555555')
            elems.append(meta_p)

            # Description
            desc = (tc.get('description') or '').strip()
            if desc:
                lbl = _make_label_value_elem(doc, 'Description', '')
                elems.append(lbl)
                for line in _split_lines(desc):
                    elems.append(_make_bullet_elem(doc, line))

            # Test Steps
            steps_raw = tc.get('steps', '')
            steps = _split_lines(steps_raw) if isinstance(steps_raw, str) else (steps_raw or [])
            if steps:
                elems.append(_make_para_elem(doc, 'Test Steps:', bold=True, size_pt=10))
                for i, step in enumerate(steps, 1):
                    elems.append(_make_para_elem(doc, f'{i}. {step}', size_pt=10))

            # Expected Result
            exp_raw = tc.get('expected', '')
            exp_lines = _split_lines(exp_raw) if isinstance(exp_raw, str) else (exp_raw or [])
            if exp_lines:
                elems.append(_make_para_elem(doc, 'Expected Result:', bold=True, size_pt=10))
                for line in exp_lines:
                    elems.append(_make_bullet_elem(doc, line))

            # Execution result (if available)
            result = (tc.get('result') or '').strip()
            if result:
                color = '#1a7a1a' if result.upper() == 'PASS' else ('#cc0000' if result.upper() == 'FAIL' else '#888800')
                elems.append(_make_para_elem(doc, f'Execution Result: {result}', bold=True, size_pt=10, color_hex=color))

            # Spacer
            elems.append(_make_para_elem(doc, '', size_pt=6))

    return elems

# ─── Main ─────────────────────────────────────────────────────────────────────

def fill_template(data):
    title        = data.get('title',        'EXOS Functional Test Plan')
    jira_story   = data.get('jira_story',   '')
    release      = data.get('release',      '')
    author       = data.get('author',       '')
    reviewer     = data.get('reviewer',     '')
    approver     = data.get('approver',     '')
    version      = data.get('version',      '1.0')
    output_path  = data.get('output_path',  '/tmp/testplan_filled.docx')
    test_cases   = data.get('test_cases',   [])
    template_path = data.get('template_path', '')

    if not template_path or not Path(template_path).exists():
        raise FileNotFoundError(f'Template not found: {template_path}')

    doc = Document(template_path)
    body = doc.element.body
    body_elems = list(body)

    # ── 1. Update title paragraph (index 0) ──────────────────────────────────
    for p in doc.paragraphs:
        if p.style.name == 'Title':
            p.clear()
            run = p.add_run('EXOS Functional Test Plan')
            run.font.size = Pt(24)
            run.bold = True
            break

    # ── 2. Update subtitle (feature name) ────────────────────────────────────
    for p in doc.paragraphs:
        if p.style.name == 'Subtitle':
            p.clear()
            run = p.add_run(title)
            run.font.size = Pt(16)
            break

    # ── 3. Update release info table ─────────────────────────────────────────
    _update_release_table(doc, jira_story, release, author, reviewer, approver, version)

    # ── 4. Refresh body_elems after changes ───────────────────────────────────
    body_elems = list(body)

    # ── 5. Find "Test Cases" heading and "Appendix A" heading ────────────────
    tc_idx, tc_elem = _find_heading_elem(body_elems, 'Test Cases')
    app_idx, app_elem = _find_heading_elem(body_elems, 'Appendix A')

    if tc_elem is None:
        # Fallback: append at end
        tc_idx = len(body_elems) - 1
        tc_elem = body_elems[tc_idx]
        app_idx = len(body_elems)  # no appendix found

    # ── 6. Remove existing TC content between "Test Cases" and "Appendix A" ──
    if app_idx is not None and app_idx > tc_idx:
        _remove_between(body, tc_idx, app_idx)

    # ── 7. Build and insert new TC section blocks ─────────────────────────────
    # After removal, re-fetch body_elems and find tc_elem's new position
    body_elems = list(body)
    # tc_elem itself is still attached; find it again
    new_tc_idx = body_elems.index(tc_elem)

    # Add date header paragraph right after "Test Cases" heading
    date_str = datetime.datetime.now().strftime('%Y-%m-%d')
    date_p = _make_para_elem(doc, f'Generated: {date_str}  |  Jira Story: {jira_story}  |  Release: {release}  |  Version: {version}',
                              size_pt=9, color_hex='#555555')
    tc_elem.addnext(date_p)

    # Build all TC section blocks and insert after the date line
    tc_blocks = _build_tc_blocks(doc, test_cases)
    _insert_elems_after(date_p, tc_blocks)

    # ── 8. Save ───────────────────────────────────────────────────────────────
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)
    print(f'Template filled and saved: {output_path}', flush=True)


if __name__ == '__main__':
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        fill_template(data)
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr, flush=True)
        sys.exit(1)
