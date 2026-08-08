#!/usr/bin/env python3
"""
EXOS Functional Test Plan DOCX generator.
Matches the Extreme Networks test plan template format.
Reads a JSON payload from stdin, writes the DOCX to output_path, and prints the path.
"""
import sys, json, datetime, re
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def _hex_rgb(h):
    h = h.lstrip('#')
    return RGBColor(int(h[0:2],16), int(h[2:4],16), int(h[4:6],16))

def _shade(cell, color_hex):
    tc = cell._tc; tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'),'clear'); shd.set(qn('w:color'),'auto')
    shd.set(qn('w:fill'), color_hex.lstrip('#'))
    tcPr.append(shd)

def _fmt(cell, size=10, bold=False, color=None):
    for para in cell.paragraphs:
        for run in para.runs:
            run.font.size = Pt(size); run.bold = bold
            if color: run.font.color.rgb = _hex_rgb(color)

def _set_col_width(table, col_idx, width_cm):
    for row in table.rows:
        row.cells[col_idx].width = Cm(width_cm)

def _spacer(doc, n=1):
    for _ in range(n):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(0)

def _normal(doc, text, bold=False, size=10):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text); run.font.size = Pt(size); run.bold = bold
    return p

def _bullet(doc, text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text); run.font.size = Pt(10)
    return p

def _h1(doc, text):
    h = doc.add_heading(text, level=1)
    h.paragraph_format.space_before = Pt(12); h.paragraph_format.space_after = Pt(4)
    for run in h.runs:
        run.font.size = Pt(14); run.font.color.rgb = _hex_rgb('#1D3557')
    return h

def _h2(doc, text):
    h = doc.add_heading(text, level=2)
    h.paragraph_format.space_before = Pt(8); h.paragraph_format.space_after = Pt(3)
    for run in h.runs:
        run.font.size = Pt(12); run.font.color.rgb = _hex_rgb('#2E5FA3')
    return h

def _h4(doc, text):
    h = doc.add_heading(text, level=4)
    h.paragraph_format.space_before = Pt(8); h.paragraph_format.space_after = Pt(2)
    for run in h.runs:
        run.font.size = Pt(10); run.bold = True
        run.font.color.rgb = _hex_rgb('#1D3557')
    return h

def _tbl_header(table, labels, bg='#1D3557'):
    row = table.rows[0] if table.rows else table.add_row()
    for i, lbl in enumerate(labels[:len(row.cells)]):
        row.cells[i].text = lbl
        _shade(row.cells[i], bg)
        _fmt(row.cells[i], size=9, bold=True, color='#FFFFFF')

def _split_lines(text):
    if not text: return []
    lines = []
    for raw in str(text).splitlines():
        line = raw.strip().lstrip('-').lstrip(u'\u2022').strip()
        line = re.sub(r'^[\d]+[\.\)]\s*', '', line).strip()
        if line and line not in ('-',''):
            lines.append(line)
    return lines

# ─── Fixed 15-section structure (EXOS FTP standard) ──────────────────────────
# Section number → (heading, keyword list for auto-routing)
# Default section when no keyword matches: section 2

TC_SECTIONS = [
    ( 1, 'Conformance to Industry Standard',
         ['conformance','rfc','ieee','ietf','industry standard','protocol standard','comply']),
    ( 2, 'Feature Adherence to Functional Spec',
         []),          # default catch-all
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
         ['usability','user interface','ease of use','user experience','workflow']),
    (14, 'Negative Testing',
         ['negative','invalid','error handling','invalid input','boundary','mismatch',
          'reject','deny','wrong','unsupported','out of range','duplicate']),
    (15, 'System Resource & Stress testing',
         ['stress','resource','memory','cpu','utilization','oom','out of memory',
          'cpu high','memory leak','system resource','load test']),
]

def _route_tc(tc):
    """Return section number (1-15) for a test case based on title/description keywords."""
    text = ((tc.get('title') or '') + ' ' + (tc.get('description') or '')).lower()
    for sec_num, _heading, keywords in TC_SECTIONS:
        if not keywords:
            continue
        if any(kw in text for kw in keywords):
            return sec_num
    return 2   # default: Feature Adherence to Functional Spec

def generate(data):
    title        = data.get('title',       'Test Plan')
    jira_story   = data.get('jira_story',  '')
    release      = data.get('release',     '')
    story_type   = data.get('story_type',  'Feature')
    doc_type     = data.get('doc_type',    'New')
    author       = data.get('author',      '')
    reviewer     = data.get('reviewer',    '')
    approver     = data.get('approver',    '')
    base_doc_ref = data.get('base_doc_ref','')
    version      = data.get('version',     '1.0')
    output_path  = data.get('output_path', '/tmp/testplan.docx')
    test_cases   = data.get('test_cases',  [])
    sessions     = data.get('sessions',    [])
    summary      = data.get('summary',     {})
    has_results  = data.get('has_results', False)

    is_enhance = (doc_type == 'Enhancement')
    today      = datetime.date.today().strftime('%d-%b-%Y')

    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(21); sec.page_height = Cm(29.7)
    sec.left_margin = Cm(2.54); sec.right_margin = Cm(2.54)
    sec.top_margin  = Cm(2.54); sec.bottom_margin = Cm(2.54)

    # Title
    tp = doc.add_paragraph(); tp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r  = tp.add_run('EXOS Functional Test Plan')
    r.bold = True; r.font.size = Pt(24); r.font.color.rgb = _hex_rgb('#1D3557')

    # Subtitle
    sp = doc.add_paragraph(); sp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sr = sp.add_run(title)
    sr.bold = True; sr.font.size = Pt(14); sr.font.color.rgb = _hex_rgb('#457B9D')

    if is_enhance:
        ep = doc.add_paragraph(); ep.alignment = WD_ALIGN_PARAGRAPH.CENTER
        er = ep.add_run('(Enhancement)')
        er.bold = True; er.font.size = Pt(12); er.font.color.rgb = _hex_rgb('#E63946')

    _spacer(doc)

    # Release Information table
    ri = doc.add_table(rows=0, cols=2); ri.style = 'Table Grid'
    hr = ri.add_row(); hr.cells[0].merge(hr.cells[1])
    hr.cells[0].text = 'Release Information'
    _shade(hr.cells[0], '#1D3557'); _fmt(hr.cells[0], size=10, bold=True, color='#FFFFFF')

    info_rows = [
        ('Release', release or u'\u2014'),
        ('Feature Number', jira_story or u'\u2014'),
        ('Story Type', story_type or u'\u2014'),
        ('CR Number', ''),
        ('Author', author or u'\u2014'),
        ('Reviewer', reviewer or u'\u2014'),
        ('Approved By', approver or u'\u2014'),
        ('Version', version),
        ('Date', today),
    ]
    if is_enhance and base_doc_ref:
        info_rows.insert(3, ('Base Document Reference', base_doc_ref))
    for label, value in info_rows:
        row = ri.add_row()
        row.cells[0].text = label; row.cells[1].text = str(value)
        _shade(row.cells[0], '#D9E2F3'); _fmt(row.cells[0], size=10, bold=True)
        _fmt(row.cells[1], size=10)
    _set_col_width(ri, 0, 5.5); _set_col_width(ri, 1, 10.5)

    _spacer(doc)

    # Revision History
    _h2(doc, 'Revision History')
    rv = doc.add_table(rows=1, cols=4); rv.style = 'Table Grid'
    _tbl_header(rv, ['Version','Date','Author','Description'])
    rr = rv.add_row()
    rr.cells[0].text = version; rr.cells[1].text = today; rr.cells[2].text = author or u'\u2014'
    rr.cells[3].text = ('Enhancement to existing test plan' + (' - Base: ' + base_doc_ref if base_doc_ref else '')) if is_enhance else 'Initial test plan'
    for cell in rr.cells: _fmt(cell, size=10)

    _spacer(doc, 2)

    # 1. Introduction
    _h1(doc, '1. Introduction')
    _h2(doc, '1.1 Overview')
    _normal(doc, 'This is the functional test plan for {f} ({s}) in release {r}. It covers test objectives, scope, test cases and execution strategy for validating the feature.{e}'.format(
        f=title, s=jira_story, r=release or 'TBD',
        e=' Refer to base document "{}" for the original test plan.'.format(base_doc_ref) if is_enhance and base_doc_ref else ''))
    _h2(doc, '1.2 Use Cases')
    _normal(doc, '')
    _h2(doc, '1.3 Limitations')
    _normal(doc, '')
    _h2(doc, '1.4 Terminology and Acronyms')
    _bullet(doc, 'DUT - Device Under Test')
    _bullet(doc, 'EXOS - ExtremeXOS')
    _bullet(doc, 'TC - Test Case')
    _normal(doc, '')

    _spacer(doc)

    # 2. Topology
    _h1(doc, '2. Topology')
    _normal(doc, '')

    _spacer(doc)

    # 3. Set up and Configurations
    _h1(doc, '3. Set up and Configurations')
    _normal(doc, '')

    _spacer(doc)

    # 4. Tools
    _h1(doc, '4. Tools')
    _bullet(doc, 'IXIA / Traffic Generator')
    _bullet(doc, 'RADIUS Server')
    _normal(doc, '')

    _spacer(doc)

    # 5. Test Cases
    _h1(doc, '5. Test Cases')

    manual_cnt = sum(1 for tc in test_cases if tc.get('classification') == 'Manual')
    semi_cnt   = sum(1 for tc in test_cases if tc.get('classification') == 'Semi-Automatable')
    auto_cnt   = sum(1 for tc in test_cases if tc.get('classification') == 'Automatable')

    st = doc.add_table(rows=1, cols=4); st.style = 'Table Grid'
    _tbl_header(st, ['Total TCs','Manual','Semi-Automatable','Automatable'])
    sr2 = st.add_row()
    sr2.cells[0].text = str(len(test_cases)); sr2.cells[1].text = str(manual_cnt)
    sr2.cells[2].text = str(semi_cnt);        sr2.cells[3].text = str(auto_cnt)
    for cell in sr2.cells: _fmt(cell, size=10, bold=True)

    if has_results:
        _spacer(doc)
        _h2(doc, 'Execution Summary')
        xt = doc.add_table(rows=1, cols=6); xt.style = 'Table Grid'
        _tbl_header(xt, ['Total','Passed','Failed','Blocked','Not Run','Pass Rate'])
        xr = xt.add_row()
        xr.cells[0].text = str(summary.get('total',0))
        xr.cells[1].text = str(summary.get('passed',0))
        xr.cells[2].text = str(summary.get('failed',0))
        xr.cells[3].text = str(summary.get('blocked',0))
        xr.cells[4].text = str(summary.get('not_run',0))
        xr.cells[5].text = '{}%'.format(summary.get('pass_rate',0))
        for cell in xr.cells: _fmt(cell, size=10, bold=True)

    _spacer(doc)

    _h2(doc, '5.1 Conformance to Industry Standard')

    # Group TCs into the fixed 15 sections by keyword detection
    sec_groups = {n: [] for n, _, _ in TC_SECTIONS}
    for tc in test_cases:
        sec_groups[_route_tc(tc)].append(tc)

    # Render all 15 sections in order; show TCs or leave blank placeholder
    for sec_num, sec_heading, _ in TC_SECTIONS:
        if sec_num == 1:
            # Already rendered header above — just add the TCs (or placeholder)
            pass
        else:
            _h2(doc, '5.{n} {h}'.format(n=sec_num, h=sec_heading))

        tcs_here = sec_groups[sec_num]
        if not tcs_here:
            _normal(doc, u'\u2014')   # em-dash placeholder for empty section
            continue

        for idx, tc in enumerate(tcs_here, start=1):
            tc_num       = tc.get('tc_number', str(idx))
            tc_title     = tc.get('title', 'Untitled')
            steps_raw    = tc.get('steps','') or tc.get('test_steps','') or ''
            expected_raw = tc.get('expected','') or tc.get('expected_result','') or ''
            result       = tc.get('result','') or 'Not Run'
            cls          = tc.get('classification','')

            _h4(doc, '{num}. {title}'.format(num=tc_num, title=tc_title))

            # Classification tag (small note)
            if cls:
                cn = doc.add_paragraph()
                cn.paragraph_format.space_after = Pt(1)
                cr = cn.add_run('Classification: {}'.format(cls))
                cr.italic = True; cr.font.size = Pt(9)

            # Methodology
            pm = doc.add_paragraph()
            pm.paragraph_format.space_after = Pt(2)
            rm = pm.add_run('Methodology:'); rm.bold = True; rm.font.size = Pt(10)
            step_lines = _split_lines(steps_raw)
            for step in step_lines:
                _normal(doc, step)
            if not step_lines:
                _normal(doc, '')

            # Pass Criteria
            ppc = doc.add_paragraph()
            ppc.paragraph_format.space_after = Pt(2)
            rpc = ppc.add_run('Pass Criteria:'); rpc.bold = True; rpc.font.size = Pt(10)
            exp_lines = _split_lines(expected_raw)
            for line in exp_lines:
                _normal(doc, line)
            if not exp_lines:
                _normal(doc, '')

            if has_results:
                _normal(doc, 'Result: {}'.format(result))
            _normal(doc, 'Sanity (Yes/No): ')

    _spacer(doc)

    # 6. Appendix A
    _h1(doc, '6. Appendix A: References')
    if base_doc_ref: _bullet(doc, 'Base Document: {}'.format(base_doc_ref))
    _bullet(doc, 'Jira Story: {}'.format(jira_story or u'\u2014'))
    _normal(doc, '')

    # 7. Appendix B
    _h1(doc, '7. Appendix B: Minutes of Test Plan Review Meeting')
    mt = doc.add_table(rows=1, cols=3); mt.style = 'Table Grid'
    _tbl_header(mt, ['Date','Attendees','Minutes / Notes'])
    mr = mt.add_row()
    for cell in mr.cells: cell.text = ''; _fmt(cell, size=10)

    _spacer(doc)

    # 8. Action Items
    _h1(doc, '8. Review Meeting Action Items')
    at = doc.add_table(rows=1, cols=4); at.style = 'Table Grid'
    _tbl_header(at, ['#','Action Item','Owner','Status'])
    ar = at.add_row()
    ar.cells[0].text = '1'
    for cell in ar.cells[1:]: cell.text = ''
    for cell in ar.cells: _fmt(cell, size=10)

    doc.save(output_path)
    return output_path

if __name__ == '__main__':
    raw = sys.stdin.read().lstrip(u'\ufeff')  # strip BOM if present
    data = json.loads(raw)
    print(generate(data))
