"""
NOS QA Workflow Tool — PowerPoint Presentation Generator
Generates a professional PPT for project explanation from NOS_QA_WORKFLOW_COMPLETE_DOCUMENTATION.md
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt
from pptx.enum.dml import MSO_THEME_COLOR
import copy

# ── Colour Palette ────────────────────────────────────────────────────────────
NAVY       = RGBColor(0x0D, 0x1B, 0x3E)   # deep navy  – title / header bg
TEAL       = RGBColor(0x00, 0xB4, 0xBF)   # teal       – accent / bullets
LIGHT_TEAL = RGBColor(0xE0, 0xF7, 0xFA)   # pale teal  – alt row
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GRAY  = RGBColor(0x22, 0x22, 0x33)
MID_GRAY   = RGBColor(0x55, 0x55, 0x66)
ORANGE     = RGBColor(0xFF, 0x77, 0x00)
GREEN      = RGBColor(0x00, 0xC8, 0x53)
LIGHT_GRAY = RGBColor(0xF4, 0xF6, 0xF8)
SLATE      = RGBColor(0x37, 0x47, 0x5A)

# ── Slide dimensions (widescreen 16:9) ────────────────────────────────────────
W = Inches(13.33)
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H

blank_layout = prs.slide_layouts[6]   # completely blank

# ── Helpers ──────────────────────────────────────────────────────────────────

def add_rect(slide, x, y, w, h, fill_color, line_color=None):
    shape = slide.shapes.add_shape(1, x, y, w, h)  # MSO_SHAPE_TYPE.RECTANGLE = 1
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if line_color:
        shape.line.color.rgb = line_color
        shape.line.width = Pt(0.75)
    else:
        shape.line.fill.background()
    return shape

def add_textbox(slide, text, x, y, w, h,
                font_size=18, bold=False, color=DARK_GRAY,
                align=PP_ALIGN.LEFT, italic=False, word_wrap=True):
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = word_wrap
    tf  = txb.text_frame
    tf.word_wrap = word_wrap
    p   = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size  = Pt(font_size)
    run.font.bold  = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txb

def add_bullet_tf(slide, items, x, y, w, h,
                  font_size=15, color=DARK_GRAY,
                  bullet_color=TEAL, heading=None,
                  heading_size=16, line_spacing=1.2):
    """Text-frame with optional heading + bullet list."""
    txb = slide.shapes.add_textbox(x, y, w, h)
    txb.word_wrap = True
    tf  = txb.text_frame
    tf.word_wrap = True

    if heading:
        p = tf.paragraphs[0]
        p.space_after = Pt(4)
        run = p.add_run()
        run.text = heading
        run.font.size  = Pt(heading_size)
        run.font.bold  = True
        run.font.color.rgb = TEAL

    for i, item in enumerate(items):
        if heading or i > 0:
            p = tf.add_paragraph()
        else:
            p = tf.paragraphs[0]
        p.space_before = Pt(2)
        p.space_after  = Pt(2)

        if isinstance(item, tuple):
            # (text, indent_level)
            text, indent = item
        else:
            text, indent = item, 0

        # Bullet prefix
        prefix = "  " * indent + ("▸ " if indent == 0 else "   • ")
        run = p.add_run()
        run.text = prefix
        run.font.size  = Pt(font_size)
        run.font.bold  = True
        run.font.color.rgb = bullet_color

        run2 = p.add_run()
        run2.text = text
        run2.font.size  = Pt(font_size)
        run2.font.color.rgb = color

    return txb

def title_bar(slide, title, subtitle=None):
    """Top header bar with navy background."""
    bar = add_rect(slide, 0, 0, W, Inches(1.25), NAVY)
    add_textbox(slide, title,
                Inches(0.4), Inches(0.12), Inches(12.5), Inches(0.75),
                font_size=28, bold=True, color=WHITE)
    if subtitle:
        add_textbox(slide, subtitle,
                    Inches(0.4), Inches(0.82), Inches(12.5), Inches(0.38),
                    font_size=14, color=TEAL)

def footer_bar(slide, label="NOS QA Workflow Tool  |  Project Presentation  |  2026"):
    add_rect(slide, 0, Inches(7.12), W, Inches(0.38), NAVY)
    add_textbox(slide, label,
                Inches(0.3), Inches(7.14), Inches(12.7), Inches(0.3),
                font_size=10, color=RGBColor(0xAA, 0xAA, 0xCC),
                align=PP_ALIGN.CENTER)

def content_slide(title, subtitle=None):
    slide = prs.slides.add_slide(blank_layout)
    add_rect(slide, 0, 0, W, H, LIGHT_GRAY)   # bg
    title_bar(slide, title, subtitle)
    footer_bar(slide)
    return slide

def divider_slide(section_number, section_title, icon=""):
    slide = prs.slides.add_slide(blank_layout)
    add_rect(slide, 0, 0, W, H, NAVY)
    add_rect(slide, 0, Inches(2.9), W, Inches(0.08), TEAL)
    add_textbox(slide, f"SECTION {section_number}", Inches(1.2), Inches(2.0),
                Inches(11), Inches(0.55), font_size=16, color=TEAL,
                align=PP_ALIGN.CENTER, bold=True)
    add_textbox(slide, f"{icon}  {section_title}", Inches(1.2), Inches(3.1),
                Inches(11), Inches(1.2), font_size=36, bold=True, color=WHITE,
                align=PP_ALIGN.CENTER)
    footer_bar(slide)
    return slide

def info_card(slide, x, y, w, h, heading, body_lines,
              header_color=TEAL, body_color=WHITE,
              text_color=DARK_GRAY, head_text_color=WHITE,
              font_size=13, head_font_size=14):
    """Rounded-corner card: coloured header + white body."""
    # header
    hdr = add_rect(slide, x, y, w, Inches(0.42), header_color)
    add_textbox(slide, heading, x + Inches(0.1), y + Inches(0.04),
                w - Inches(0.2), Inches(0.35),
                font_size=head_font_size, bold=True, color=head_text_color)
    # body
    body_h = h - Inches(0.42)
    add_rect(slide, x, y + Inches(0.42), w, body_h, body_color,
             line_color=RGBColor(0xCC, 0xCC, 0xDD))
    tf_h = body_h - Inches(0.1)
    txb = slide.shapes.add_textbox(
        x + Inches(0.12), y + Inches(0.5), w - Inches(0.24), tf_h)
    txb.word_wrap = True
    tf = txb.text_frame
    tf.word_wrap = True
    for i, line in enumerate(body_lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_before = Pt(1)
        p.space_after  = Pt(1)
        if line.startswith("• ") or line.startswith("▸ "):
            r1 = p.add_run(); r1.text = line[:2]
            r1.font.bold = True; r1.font.color.rgb = TEAL
            r1.font.size = Pt(font_size)
            r2 = p.add_run(); r2.text = line[2:]
            r2.font.size = Pt(font_size); r2.font.color.rgb = text_color
        else:
            r = p.add_run(); r.text = line
            r.font.size = Pt(font_size); r.font.color.rgb = text_color

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — Title
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, 0, 0, W, H, NAVY)

# Decorative accent bar
add_rect(slide, 0, Inches(4.35), W, Inches(0.08), TEAL)
add_rect(slide, 0, Inches(4.43), W, Inches(0.04), ORANGE)

add_textbox(slide, "NOS QA WORKFLOW TOOL",
            Inches(0.8), Inches(1.6), Inches(11.7), Inches(1.1),
            font_size=44, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

add_textbox(slide, "End-to-End AI-Assisted QA Automation Platform for EXOS Networking Software",
            Inches(1.0), Inches(2.8), Inches(11.3), Inches(0.7),
            font_size=18, color=TEAL, align=PP_ALIGN.CENTER)

add_textbox(slide, "From Jira Story  →  Skill File  →  Test Plan  →  TCL Scripts  →  Execution  →  Report",
            Inches(1.5), Inches(3.55), Inches(10.3), Inches(0.55),
            font_size=14, color=RGBColor(0xBB, 0xBB, 0xCC), align=PP_ALIGN.CENTER, italic=True)

add_textbox(slide, "Project Explanation  |  EXOS QA Platform Team  |  July 2026",
            Inches(1.0), Inches(6.6), Inches(11.3), Inches(0.45),
            font_size=13, color=RGBColor(0x77, 0x88, 0xAA), align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — Agenda
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Agenda", "What we'll cover today")
cols = [
    ("01", "Project Overview & Objectives"),
    ("02", "System Architecture"),
    ("03", "Complete 7-Stage Workflow"),
    ("04", "AI & LLM Integration Strategy"),
    ("05", "Quality Assurance Pipeline"),
    ("06", "TCL Framework Integration"),
    ("07", "Database & API Design"),
    ("08", "Security & Deployment"),
]
card_w = Inches(5.9)
card_h = Inches(0.62)
start_x = [Inches(0.4), Inches(6.9)]
start_y = Inches(1.45)
gap = Inches(0.72)

for i, (num, label) in enumerate(cols):
    col = i % 2
    row = i // 2
    x = start_x[col]
    y = start_y + row * gap
    bg = add_rect(slide, x, y, card_w, card_h, WHITE,
                  line_color=RGBColor(0xCC, 0xCC, 0xDD))
    # number badge
    add_rect(slide, x, y, Inches(0.62), card_h, TEAL)
    add_textbox(slide, num, x + Inches(0.04), y + Inches(0.14),
                Inches(0.54), Inches(0.36), font_size=18, bold=True,
                color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(slide, label, x + Inches(0.72), y + Inches(0.1),
                Inches(5.1), Inches(0.45), font_size=15, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — Project Overview
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Project Overview", "What is the NOS QA Workflow Tool?")

add_textbox(slide, "An end-to-end AI-assisted QA automation platform that transforms a Jira feature story "
            "into a fully automated test execution cycle — using Claude LLM at every stage.",
            Inches(0.4), Inches(1.35), Inches(12.5), Inches(0.7),
            font_size=14, color=SLATE, italic=True)

objectives = [
    ("SPEED",       GREEN,  "Reduce test plan creation from days to hours"),
    ("CONSISTENCY", TEAL,   "Enforce EXOS QA standards via automated validation"),
    ("AUTOMATION",  ORANGE, "Maximize TCL script automation through AI classification"),
    ("TRACEABILITY",NAVY,   "Full audit trail: Jira story → execution → report"),
    ("QUALITY",     RGBColor(0x80,0x00,0x80), "Multi-layer AI evaluation with A–F grading"),
]
for i, (label, color, desc) in enumerate(objectives):
    y = Inches(2.2) + i * Inches(0.9)
    add_rect(slide, Inches(0.4), y, Inches(2.2), Inches(0.68), color)
    add_textbox(slide, label, Inches(0.45), y + Inches(0.12),
                Inches(2.1), Inches(0.48), font_size=15, bold=True, color=WHITE)
    add_rect(slide, Inches(2.6), y, Inches(10.3), Inches(0.68), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    add_textbox(slide, desc, Inches(2.75), y + Inches(0.16),
                Inches(10.0), Inches(0.4), font_size=14, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — What Makes It Unique
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("What Makes This Project Unique", "Key differentiators")

cards = [
    ("Domain-Specific LLM Prompting",
     ["▸ 3,746 TCL procedures indexed across 552 files",
      "▸ TCL Topology Guide injected into every AI call",
      "▸ SNMP, Traffic, CLI proc knowledge in context"]),
    ("Multi-Layer Quality Pipeline",
     ["▸ Generation → Normalization → Validation",
      "▸ AI Evaluation → Human Approval → Versioning",
      "▸ Grading A–F at each generation stage"]),
    ("Hybrid AI Model Strategy",
     ["▸ Claude Opus for complex generation tasks",
      "▸ Claude Sonnet for fast classification/review",
      "▸ Claude Vision for topology PDF analysis"]),
    ("LLM Drift Mitigation",
     ["▸ JSON schema enforcement + retry logic",
      "▸ Deduplication guards on classification",
      "▸ Generation locks prevent double-writes"]),
]

cw = Inches(6.2)
ch = Inches(2.4)
positions = [(Inches(0.3), Inches(1.45)), (Inches(6.8), Inches(1.45)),
             (Inches(0.3), Inches(4.0)),  (Inches(6.8), Inches(4.0))]

for (x, y), (heading, lines) in zip(positions, cards):
    info_card(slide, x, y, cw, ch, heading, lines, font_size=13)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — System Architecture
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("02", "System Architecture", "🏗")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — System Architecture
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("System Architecture", "4-tier layered design")

layers = [
    (Inches(1.5), WHITE,      TEAL,   "FRONTEND",   "React 18 + Vite  |  Ant Design UI  |  Zustand State  |  Port 5101"),
    (Inches(2.55),LIGHT_GRAY, NAVY,   "BACKEND",    "Node.js 16 + Express.js  |  LLM Orchestration  |  File Processing  |  Port 5100"),
    (Inches(3.6), WHITE,      TEAL,   "DATA LAYER", "SQLite WAL  |  better-sqlite3  |  /uploads/ (documents, scripts, chat files)"),
    (Inches(4.65),LIGHT_GRAY, ORANGE, "EXTERNAL",   "Anthropic Claude API  |  Jira REST API  |  qTest API"),
]

for (y, bg, accent, label, desc) in layers:
    add_rect(slide, Inches(0.3), y, Inches(12.7), Inches(0.88), bg,
             line_color=RGBColor(0xBB,0xBB,0xCC))
    add_rect(slide, Inches(0.3), y, Inches(2.0), Inches(0.88), accent)
    add_textbox(slide, label, Inches(0.35), y + Inches(0.2),
                Inches(1.9), Inches(0.5), font_size=13, bold=True, color=WHITE)
    add_textbox(slide, desc, Inches(2.45), y + Inches(0.22),
                Inches(10.5), Inches(0.5), font_size=13, color=DARK_GRAY)
    # Arrow
    add_textbox(slide, "⬇", Inches(6.4), y + Inches(0.9),
                Inches(0.5), Inches(0.4), font_size=16, color=TEAL, align=PP_ALIGN.CENTER)

add_textbox(slide, "REST API + WebSocket (Socket.IO)", Inches(6.8), Inches(2.38),
            Inches(4.5), Inches(0.3), font_size=11, color=MID_GRAY, italic=True)
add_textbox(slide, "Synchronous SQLite driver", Inches(6.8), Inches(3.45),
            Inches(4.5), Inches(0.3), font_size=11, color=MID_GRAY, italic=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — Technology Stack
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Technology Stack", "Full-stack tooling overview")

stacks = [
    ("Backend", NAVY, [
        "Node.js 16.20.2 (NVM)  —  Runtime",
        "Express.js 4.x  —  REST API framework",
        "better-sqlite3  —  Synchronous SQLite driver",
        "@anthropic-ai/sdk  —  Claude API client",
        "socket.io  —  Real-time WebSocket events",
        "multer  —  File upload handling",
        "jsonwebtoken + bcryptjs  —  Auth & security",
    ]),
    ("Frontend", TEAL, [
        "React 18  —  UI framework",
        "Vite  —  Build tool",
        "Ant Design 5.x  —  UI component library",
        "Zustand  —  State management",
        "Axios  —  HTTP client",
        "Recharts  —  Execution results charts",
        "React Markdown  —  Markdown rendering",
    ]),
    ("AI Services", ORANGE, [
        "claude-opus-4-8  —  Generation (heavy)",
        "claude-sonnet-4-6  —  Classification (light)",
        "Claude Vision API  —  Topology PDF analysis",
        "poppler-utils (pdftoppm)  —  PDF→PNG",
        "pdfminer.six  —  PDF text extraction",
        "python-docx  —  DOCX extraction",
    ]),
]

cw = Inches(4.1)
for i, (title, color, items) in enumerate(stacks):
    x = Inches(0.35) + i * Inches(4.3)
    add_rect(slide, x, Inches(1.4), cw, Inches(0.45), color)
    add_textbox(slide, title, x + Inches(0.1), Inches(1.45),
                cw - Inches(0.2), Inches(0.38), font_size=15, bold=True, color=WHITE)
    add_rect(slide, x, Inches(1.85), cw, Inches(5.25), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    for j, item in enumerate(items):
        y = Inches(2.0) + j * Inches(0.7)
        bullet_r = add_rect(slide, x + Inches(0.15), y + Inches(0.12),
                             Inches(0.06), Inches(0.28), color)
        add_textbox(slide, item, x + Inches(0.32), y,
                    cw - Inches(0.45), Inches(0.6), font_size=12, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — Workflow
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("03", "Complete 7-Stage Workflow", "⚙")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — Workflow Stage Map
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("The 7-Stage Workflow", "End-to-end process from Jira to Report")

stages = [
    ("1", "Jira Story Selection",    TEAL),
    ("2", "Skill File Generation",   NAVY),
    ("3", "Test Plan Generation",    TEAL),
    ("4", "TC Classification",       NAVY),
    ("7", "TCL Script Generation",   TEAL),
    ("8", "TC Execution",            NAVY),
    ("9", "Completion & Report",     ORANGE),
]

box_w = Inches(1.6)
box_h = Inches(1.1)
start_x = Inches(0.35)
y1 = Inches(2.1)
y2 = Inches(3.6)
spacing = Inches(1.83)

for i, (num, name, color) in enumerate(stages):
    x = start_x + i * spacing
    y = y1 if i % 2 == 0 else y2
    add_rect(slide, x, y, box_w, box_h, color)
    add_textbox(slide, f"Stage {num}", x + Inches(0.05), y + Inches(0.05),
                box_w - Inches(0.1), Inches(0.38), font_size=12, bold=True, color=WHITE)
    add_textbox(slide, name, x + Inches(0.05), y + Inches(0.5),
                box_w - Inches(0.1), Inches(0.56), font_size=11, color=WHITE)

    if i < len(stages) - 1:
        arrow_x = x + box_w + Inches(0.1)
        arrow_y = y + Inches(0.35)
        add_textbox(slide, "→", arrow_x, arrow_y, Inches(0.5), Inches(0.45),
                    font_size=22, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

# Stage descriptions
descs = [
    "Select Jira feature story\nfrom release backlog",
    "AI generates domain-specific\nskill file from story + docs",
    "AI creates structured test\nplan with numbered TCs",
    "LLM classifies each TC:\nAuto / Semi-Auto / Manual",
    "Generate TCL scripts per TC\nusing framework proc index",
    "Record Pass/Fail/Blocked\nresults per test session",
    "Summary, HTML report,\nqTest upload, DOCX export",
]

for i, desc in enumerate(descs):
    x = start_x + i * spacing
    y = Inches(4.85) if i % 2 == 0 else Inches(1.05)
    add_textbox(slide, desc, x, y, box_w, Inches(0.85),
                font_size=10, color=SLATE, italic=True)

add_textbox(slide, "⚠ Stages 5 & 6 were deprecated and merged into Stage 9",
            Inches(0.4), Inches(6.55), Inches(12.5), Inches(0.35),
            font_size=11, color=MID_GRAY, italic=True, align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — Stage 1 & 2
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Stage 1 & 2  —  Jira Story + Skill File Generation")

info_card(slide, Inches(0.3), Inches(1.4), Inches(6.2), Inches(5.7),
          "Stage 1 — Jira Story Selection", [
    "• Select EXOS release from Jira fix-versions",
    "• Browse feature stories with priority + type badges",
    "• Auto-detect story type:",
    "   API/endpoint/REST  →  NOS API Endpoint",
    "   Otherwise  →  Feature Functionality",
    "• Save: story ID, title, description, release",
    "• LLM Usage: None (pure Jira REST API)",
    "",
    "Output: jira_story_id, jira_release, jira_description",
    "         saved to workflows table",
], font_size=12)

info_card(slide, Inches(6.8), Inches(1.4), Inches(6.2), Inches(5.7),
          "Stage 2 — Skill File Generation", [
    "• Upload: feature spec, previous spec, existing plan",
    "• Additional CLI commands + QA interactions text",
    "• Chat advisor for context refinement",
    "",
    "AI Generation (claude-opus-4-8):",
    "• Feature Overview + CLI Commands & Syntax",
    "• Topology Requirements + Test Scenarios",
    "• Error Conditions + Automation Guidance",
    "",
    "AI Evaluation (claude-sonnet-4-6):",
    "• CLI Coverage (25%)  Topology (20%)",
    "• Error Conditions (20%)  Scenarios (20%)",
    "• Automation Readiness (15%)  →  Grade A–F",
    "",
    "Versioning: every regeneration = new document version",
], font_size=12)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — Stage 3 Test Plan
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Stage 3  —  Test Plan Generation", "Multi-layer quality pipeline")

# Coverage levels
cvg = [("SANITY", "Critical path only\n10–20 TCs", GREEN),
       ("STANDARD", "Full functional\n30–60 TCs", TEAL),
       ("COMPREHENSIVE", "Edge cases + stress\n60–120+ TCs", ORANGE)]
for i, (lvl, desc, color) in enumerate(cvg):
    x = Inches(0.3) + i * Inches(2.65)
    add_rect(slide, x, Inches(1.4), Inches(2.45), Inches(0.38), color)
    add_textbox(slide, lvl, x + Inches(0.08), Inches(1.43),
                Inches(2.3), Inches(0.3), font_size=11, bold=True, color=WHITE)
    add_rect(slide, x, Inches(1.78), Inches(2.45), Inches(0.65), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    add_textbox(slide, desc, x + Inches(0.1), Inches(1.82),
                Inches(2.3), Inches(0.58), font_size=10, color=DARK_GRAY)

# Pipeline
pipeline = [
    ("1 GENERATE", NAVY,   "claude-opus-4-8\nraw markdown test plan"),
    ("2 NORMALIZE", TEAL,  "Fix headings, TC numbers\nCLI blocks, table alignment"),
    ("3 VALIDATE",  GREEN, "Score 0–100, Grade A–F\nCritical / Major / Minor issues"),
    ("4 STORE",     SLATE, "documents + test_cases\ndocument_validations tables"),
]
pw = Inches(3.0)
ph = Inches(1.7)
for i, (label, color, desc) in enumerate(pipeline):
    x = Inches(0.3) + i * Inches(3.22)
    add_rect(slide, x, Inches(2.65), pw, Inches(0.42), color)
    add_textbox(slide, label, x + Inches(0.1), Inches(2.68),
                pw - Inches(0.2), Inches(0.35), font_size=12, bold=True, color=WHITE)
    add_rect(slide, x, Inches(3.07), pw, ph - Inches(0.42), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    add_textbox(slide, desc, x + Inches(0.1), Inches(3.12),
                pw - Inches(0.2), Inches(1.2), font_size=12, color=DARK_GRAY)
    if i < 3:
        add_textbox(slide, "→", x + pw + Inches(0.1), Inches(3.15),
                    Inches(0.25), Inches(0.45), font_size=20, bold=True,
                    color=TEAL, align=PP_ALIGN.CENTER)

# Input sources
add_textbox(slide, "Supplementary Inputs:", Inches(0.3), Inches(4.65),
            Inches(3.5), Inches(0.35), font_size=13, bold=True, color=TEAL)
inputs_txt = ("Dev unit test plan  |  QA functional one-liners  |  Topology PDF/image (vision AI)  "
              "|  Topology description  |  User instructions  |  Chat session context")
add_textbox(slide, inputs_txt, Inches(0.3), Inches(5.05), Inches(12.7), Inches(0.55),
            font_size=12, color=DARK_GRAY)

add_textbox(slide, "TC Fix per item (claude-opus-4-8): missing_steps | incorrect_steps | more_detail | wrong_tc | manual_edit",
            Inches(0.3), Inches(5.75), Inches(12.7), Inches(0.42),
            font_size=12, color=SLATE, italic=True)
add_textbox(slide, "Regenerate with Review Comments: claude-opus-4-8 addresses all reviewer feedback in one pass → new revision",
            Inches(0.3), Inches(6.2), Inches(12.7), Inches(0.42),
            font_size=12, color=SLATE, italic=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — Stage 4 & 7
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Stage 4 & 7  —  Classification + Script Generation")

info_card(slide, Inches(0.3), Inches(1.4), Inches(6.2), Inches(5.7),
          "Stage 4 — TC Classification (claude-sonnet-4-6)", [
    "Auto-classify every TC:",
    "• Automatable — all steps via CLI/SNMP/traffic procs",
    "• Semi-Automatable — mostly scriptable + human checkpoint",
    "• Manual — physical action required (PSU swap, console)",
    "",
    "Framework knowledge injected:",
    "• SendCliCommand, CheckCliOutput",
    "• snmpget_authNoPriv, snmpget_Priv, snmpset_Priv",
    "• snmpHandleTraps, SnmpCheckKeyValue_snmp",
    "• CheckReboot, RestartProcess, SendFrame (IXIA)",
    "",
    "Dedup guard: filters duplicate tc_numbers from LLM",
    "Manual override: any TC re-classifiable with reason",
    "",
    "Chat Advisor (claude-opus-4-8):",
    "• Explains why TC is Semi/Manual",
    "• <<<ACTION>>> protocol embeds fix instructions",
    "• Auto-fixes TC in test plan + reclassifies",
], font_size=11)

info_card(slide, Inches(6.8), Inches(1.4), Inches(6.2), Inches(5.7),
          "Stage 7 — TCL Script Generation (claude-opus-4-8)", [
    "Generates one TCL script per Automatable/Semi-Auto TC",
    "",
    "Framework knowledge injected per call:",
    "• 3,746-proc TCL index (552 files)",
    "• Topology Guide — node setup conventions",
    "• Traffic Patterns — SendFrame, SendIP, IXIA",
    "• SNMP Library + CLI Syntax Guide",
    "",
    "Dedup: DELETE old script before INSERT new version",
    "GET returns MAX(rowid) GROUP BY test_case_id",
    "",
    "Generation Lock: in-memory Set prevents double-gen",
    "Status endpoint: { generating: true/false }",
    "Proceed button disabled during generation",
    "",
    "AI Batch Review (claude-sonnet-4-6, 3 parallel):",
    "• Score 0–100  |  Verdict: Approved / Needs Imp / Rejected",
    "• Issue tags: Critical / Warning / Tip",
    "• Improve button per script → targeted regeneration",
], font_size=11)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — Stage 8 & 9
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Stage 8 & 9  —  Execution + Completion")

info_card(slide, Inches(0.3), Inches(1.4), Inches(6.2), Inches(5.7),
          "Stage 8 — TC Execution", [
    "Execution Session: Platform + Build + Environment",
    "Platforms: X440G2, X460G2, X465, 5320, 5520, 7520 …",
    "",
    "Per-TC result recording:",
    "• pass / fail / blocked / not_run",
    "• Platform, build, failure notes stored",
    "• Row colors: green/red/orange per result",
    "",
    "TC Editor Modal:",
    "• Edit Title, Steps, Classification per TC",
    "• TC content loaded from test plan markdown",
    "• Delete TC (cascades: scripts + results)",
    "",
    "Update Test Plan with Results:",
    "• Appends Execution Summary section to plan",
    "• dry_run mode for pre-check (no DB write)",
    "",
    "Approve & Proceed: idempotent → always navigates",
], font_size=11)

info_card(slide, Inches(6.8), Inches(1.4), Inches(6.2), Inches(5.7),
          "Stage 9 — Completion & Reporting", [
    "Execution Summary Dashboard:",
    "• Stats: Total | Pass | Fail | Blocked | Not Run | Pass%",
    "• Pie chart (Recharts) — result distribution",
    "• Classification breakdown: Auto / Semi / Manual",
    "• All sessions timeline + TC results table",
    "",
    "Downloads:",
    "• HTML Test Report — client-side, self-contained",
    "  TestReport_EXOS-XXXXX_2026-07-28.html",
    "• XLSX for qTest — qTest-compatible format",
    "• ISO DOCX — formal test plan with author/reviewer",
    "",
    "qTest Upload:",
    "• Direct API push to configured qTest instance",
    "• Reports: uploaded count, per-TC status",
    "",
    "Mark Complete → goToDashboard() auto-navigation",
], font_size=11)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — AI & LLM
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("04", "AI & LLM Integration Strategy", "🤖")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — LLM Model Strategy
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("LLM Integration & Model Strategy", "Right model for the right task")

# Heavy model
add_rect(slide, Inches(0.3), Inches(1.4), Inches(6.2), Inches(2.45), NAVY)
add_textbox(slide, "HEAVY MODEL", Inches(0.45), Inches(1.5),
            Inches(6.0), Inches(0.45), font_size=14, bold=True, color=TEAL)
add_textbox(slide, "claude-opus-4-8", Inches(0.45), Inches(1.95),
            Inches(6.0), Inches(0.55), font_size=22, bold=True, color=WHITE)
heavy_uses = ["Skill File Generation (Stage 2)",
              "Test Plan Generation (Stage 3)",
              "TCL Script Generation (Stage 7)",
              "Individual TC Fix + Chat TC Fix (Stages 3, 4)"]
for i, u in enumerate(heavy_uses):
    add_textbox(slide, f"▸  {u}", Inches(0.45), Inches(2.55) + i * Inches(0.3),
                Inches(6.0), Inches(0.28), font_size=11, color=RGBColor(0xBB,0xCC,0xFF))

# Light model
add_rect(slide, Inches(6.8), Inches(1.4), Inches(6.2), Inches(2.45), SLATE)
add_textbox(slide, "LIGHT MODEL", Inches(6.95), Inches(1.5),
            Inches(6.0), Inches(0.45), font_size=14, bold=True, color=TEAL)
add_textbox(slide, "claude-sonnet-4-6", Inches(6.95), Inches(1.95),
            Inches(6.0), Inches(0.55), font_size=22, bold=True, color=WHITE)
light_uses = ["TC Classification (Stage 4)",
              "AI Batch Script Review (Stage 7)",
              "Chat Advisor — all stages",
              "Skill File & Test Plan Evaluation"]
for i, u in enumerate(light_uses):
    add_textbox(slide, f"▸  {u}", Inches(6.95), Inches(2.55) + i * Inches(0.3),
                Inches(6.0), Inches(0.28), font_size=11, color=RGBColor(0xBB,0xCC,0xFF))

# Vision
add_rect(slide, Inches(0.3), Inches(4.05), Inches(12.7), Inches(1.0), TEAL)
add_textbox(slide, "VISION AI  —  claude-sonnet-4-6  +  poppler-utils (pdftoppm)",
            Inches(0.5), Inches(4.12), Inches(12.3), Inches(0.45),
            font_size=14, bold=True, color=WHITE)
add_textbox(slide,
            "Topology PDFs: pdftoppm converts page 1 → PNG at 150 DPI  →  base64-encoded  →  "
            "Claude Vision analyzes devices, labels, ports, VLANs, subnets  →  "
            "Result injected into AI context for topology-aware TC generation",
            Inches(0.5), Inches(4.6), Inches(12.3), Inches(0.42),
            font_size=12, color=WHITE, italic=True)

# callLLM box
add_rect(slide, Inches(0.3), Inches(5.2), Inches(12.7), Inches(1.6), WHITE,
         line_color=RGBColor(0xBB,0xBB,0xDD))
add_textbox(slide, "Central callLLM() Wrapper:", Inches(0.5), Inches(5.28),
            Inches(5.0), Inches(0.35), font_size=13, bold=True, color=TEAL)
add_textbox(slide,
            "model = heavy ? claude-opus-4-8 : claude-sonnet-4-6\n"
            "max_tokens: heavy → 8192  |  light → 4096\n"
            "temperature: generation 0.7  |  classification 0.2  |  evaluation 0.3",
            Inches(0.5), Inches(5.65), Inches(12.3), Inches(1.0),
            font_size=12, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 13 — LLM Drift Mitigation
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("LLM Drift Mitigation", "Techniques to ensure reliable AI outputs")

techniques = [
    ("JSON Schema Enforcement",
     "System prompt specifies exact JSON format with examples.\n"
     "JSON.parse() with try/catch; on failure: fallback value or retry.\n"
     "Strips ```json fences before parsing."),
    ("Deduplication Guards",
     "TC Classification sometimes returns duplicate tc_numbers.\n"
     "Filtered with a Set: first occurrence kept, subsequent discarded.\n"
     "Applied before DB writes."),
    ("Script Deduplication",
     "Before inserting a new TCL script → DELETE old version for same TC.\n"
     "GET endpoint returns MAX(rowid) GROUP BY test_case_id.\n"
     "Prevents stale scripts from cluttering Stage 7 view."),
    ("Generation Lock",
     "In-memory Set: generatingWorkflows.add(workflow_id).\n"
     "Status endpoint returns { generating: true/false }.\n"
     "Proceed button disabled while generating; finally{} always clears lock."),
    ("Content Validation",
     "All LLM outputs trimmed before storage.\n"
     "Empty responses trigger error instead of saving blank content.\n"
     "Validation score < 70 flags document as 'failed'."),
    ("Retry on Parse Failure",
     "Critical structured outputs: up to 2 retries.\n"
     "Retry uses simplified prompt to reduce hallucination.\n"
     "Fallback data returned if all retries fail."),
]

cw = Inches(6.1)
ch = Inches(1.55)
for i, (title, body) in enumerate(techniques):
    col = i % 2
    row = i // 2
    x = Inches(0.3) + col * Inches(6.5)
    y = Inches(1.45) + row * Inches(1.75)
    info_card(slide, x, y, cw, ch, title,
              [line for line in body.split("\n")], font_size=12)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 14 — AI Chat Advisor
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("AI Chat Advisor", "Stage 2 & 3 floating chat panel")

# Left: how it works
info_card(slide, Inches(0.3), Inches(1.4), Inches(6.2), Inches(5.7),
          "How It Works", [
    "Available in Stage 2 (Skill File) and Stage 3 (Test Plan)",
    "",
    "Context injected per call:",
    "• Workflow info (story ID, title, release)",
    "• Full skill file content",
    "• Test plan content (if Stage 3)",
    "• List of test cases (if Stage 3)",
    "• TCL Topology Guide",
    "• TCL Traffic Patterns",
    "• Uploaded file content (DOCX/PDF/image)",
    "",
    "Requirements Extraction:",
    "• After each AI response, structured JSON parsed",
    "• Captures: objectives, scenarios, prerequisites,",
    "  coverage_level, topology_description",
    "",
    "When conversation_complete=true:",
    "• onRequirementsExtracted() fires",
    "• Chat Summary Modal pops up automatically",
], font_size=11)

# Right: file upload + UX
info_card(slide, Inches(6.8), Inches(1.4), Inches(6.2), Inches(5.7),
          "File Upload & Instant UX", [
    "Supported file types + extraction:",
    "• .txt / .md / .json / .yaml  →  direct read",
    "• .docx  →  python-docx paragraph extraction",
    "• .pdf (text-based)  →  pdfminer.six",
    "• .pdf (image-based)  →  pdftoppm → PNG → Vision AI",
    "• images (.jpg, .png)  →  Claude Vision directly",
    "",
    "Instant Upload Feedback UX:",
    "• Upload message appears immediately in chat",
    "• Spinner shown: 'Analyzing file… (may take seconds)'",
    "• Spinner replaced with analysis when backend responds",
    "• No blocking wait for user",
    "",
    "Chat Summary Modal:",
    "• Pops up immediately on chat complete",
    "• Shows: objectives, +scenarios, −scenarios,",
    "  prerequisites, coverage_level",
    "• 'Generate Test Plan Now' → triggers generation",
    "• 'Edit Manually' → dismisses, user fills form",
], font_size=11)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — Quality Pipeline
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("05", "Quality Assurance Pipeline", "✅")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 15 — 6-Layer Quality Pipeline
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("6-Layer Quality Assurance Pipeline", "Comprehensive validation at every stage")

layers_qa = [
    ("Layer 1", "Normalization",        TEAL,   "Auto-applied after generation — heading levels, TC numbering, CLI code blocks, table alignment"),
    ("Layer 2", "Validation Scoring",   GREEN,  "Score 0–100: Critical issue –30 pts | Major –15 pts | Minor –5 pts → Grade A–F"),
    ("Layer 3", "AI Evaluation",        NAVY,   "LLM dimensional scoring: CLI Coverage, Topology, Error Conditions, Scenarios, Automation Readiness"),
    ("Layer 4", "AI Batch Review",      ORANGE, "3 scripts in parallel — Verdict + Score + Issue tags (Critical/Warning/Tip) per script"),
    ("Layer 5", "Human Approval",       SLATE,  "Every stage gated on explicit approval before advancement — approval logged to audit_trail"),
    ("Layer 6", "Version Control",      RGBColor(0x60,0x20,0x80), "Full version chain: document_versions + document_changes (line diffs) + version_annotations"),
]

for i, (layer, name, color, desc) in enumerate(layers_qa):
    y = Inches(1.42) + i * Inches(0.88)
    add_rect(slide, Inches(0.3), y, Inches(1.3), Inches(0.7), color)
    add_textbox(slide, layer, Inches(0.32), y + Inches(0.02),
                Inches(1.26), Inches(0.28), font_size=9, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(slide, name, Inches(0.32), y + Inches(0.3),
                Inches(1.26), Inches(0.32), font_size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_rect(slide, Inches(1.6), y, Inches(11.4), Inches(0.7), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    add_textbox(slide, desc, Inches(1.75), y + Inches(0.18),
                Inches(11.1), Inches(0.42), font_size=13, color=DARK_GRAY)

# Score table
add_textbox(slide, "Validation Scoring Reference:", Inches(0.3), Inches(6.78),
            Inches(4.0), Inches(0.28), font_size=11, bold=True, color=TEAL)
add_textbox(slide,
            "A: 90–100  |  B: 80–89  |  C: 70–79  |  D: 60–69  |  F: <60   "
            "(Pass threshold: score ≥ 70)",
            Inches(4.35), Inches(6.78), Inches(8.7), Inches(0.28),
            font_size=11, color=DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — TCL Framework
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("06", "TCL Automation Framework Integration", "📜")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 16 — TCL Framework Integration
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("TCL Framework Integration", "Domain-specific knowledge injection")

# Stats bar
add_rect(slide, Inches(0.3), Inches(1.4), Inches(12.7), Inches(0.78), NAVY)
stats = [("3,746", "Indexed Procedures"), ("552", "TCL Source Files"),
         ("5", "Framework Doc Files"), ("3", "Topology Types")]
for i, (num, label) in enumerate(stats):
    x = Inches(0.9) + i * Inches(3.15)
    add_textbox(slide, num, x, Inches(1.42), Inches(2.5), Inches(0.42),
                font_size=26, bold=True, color=TEAL, align=PP_ALIGN.CENTER)
    add_textbox(slide, label, x, Inches(1.85), Inches(2.5), Inches(0.28),
                font_size=11, color=WHITE, align=PP_ALIGN.CENTER)

# Framework docs
info_card(slide, Inches(0.3), Inches(2.35), Inches(6.2), Inches(2.3),
          "Framework Documentation Files", [
    "• Topology_Guide.md  — node setup, port conventions",
    "• Traffic_Patterns.md  — SendFrame, SendIP, IXIA procs",
    "• SNMP_Library.md  — OIDs, proc signatures, auth modes",
    "• CLI_Syntax_Guide.md  — EXOS command format patterns",
    "• Switch_Events.md  — CheckReboot, RestartProcess, WaitForPort",
], font_size=12)

# Topology types
info_card(slide, Inches(6.8), Inches(2.35), Inches(6.2), Inches(2.3),
          "Topology Types Supported", [
    "• Single-Node  — CLI, SNMP, API, non-forwarding features",
    "• Two-Node  — L2/L3 forwarding, VLANs, QoS, IXIA traffic",
    "• Three-Node  — MSTP, MLAG, multi-hop routing, ring topology",
    "",
    "Standard: DUT1 Ports 1–24 test | 49–52 uplinks",
    "IXIA: Port A → DUT1/P1 | Port B → DUT1/P2 or DUT2/P1",
], font_size=12)

# Where injected
info_card(slide, Inches(0.3), Inches(4.82), Inches(12.7), Inches(2.28),
          "Where Framework Knowledge Is Injected", [
    "• Stage 2 Chat  — Answer TCL framework questions from QA engineers",
    "• Stage 3 Chat  — Topology-aware test plan context from uploaded diagram",
    "• Stage 4 Classification  — Know which procs exist → classify automation feasibility",
    "• Stage 7 Script Gen  — Use exact proc signatures for correct TCL code generation",
    "• Proc Index: Loaded from /data/tcl_framework_docs/automation_index.json at server startup",
], font_size=12)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — Database & API
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("07", "Database & API Design", "🗄")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 17 — Database Schema Overview
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Database Schema", "SQLite WAL — 20+ tables with full version control")

table_groups = [
    ("Core", TEAL, ["workflows", "stages", "documents"]),
    ("Test Cases", NAVY, ["test_cases", "tcl_scripts", "tc_execution_results", "execution_sessions"]),
    ("Quality", GREEN, ["document_versions", "document_changes", "document_validations", "approvals"]),
    ("Chat", ORANGE, ["chat_sessions", "chat_messages", "chat_files"]),
    ("Audit", SLATE, ["audit_trail", "version_annotations"]),
]

gw = Inches(2.4)
gh = Inches(5.3)
for i, (group, color, tables) in enumerate(table_groups):
    x = Inches(0.3) + i * Inches(2.6)
    add_rect(slide, x, Inches(1.4), gw, Inches(0.42), color)
    add_textbox(slide, group, x + Inches(0.08), Inches(1.44),
                gw - Inches(0.16), Inches(0.34), font_size=13, bold=True, color=WHITE)
    add_rect(slide, x, Inches(1.82), gw, Inches(4.88), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    for j, tbl in enumerate(tables):
        ty = Inches(2.0) + j * Inches(0.58)
        add_rect(slide, x + Inches(0.12), ty, gw - Inches(0.24), Inches(0.45),
                 LIGHT_GRAY, line_color=RGBColor(0xBB,0xBB,0xCC))
        add_textbox(slide, tbl, x + Inches(0.22), ty + Inches(0.08),
                    gw - Inches(0.44), Inches(0.32), font_size=11, color=DARK_GRAY)

add_textbox(slide, "Key design choices: WAL mode for concurrency  |  Parameterized queries (no SQL injection)  |  "
            "UUID primary keys  |  Full version history for all documents  |  Cascade deletes on TC remove",
            Inches(0.3), Inches(6.9), Inches(12.7), Inches(0.32),
            font_size=11, color=SLATE, italic=True, align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 18 — API Reference
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("API Reference Summary", "REST endpoints by stage")

api_groups = [
    ("Stages 1–3", [
        "GET  /api/stage1/releases",
        "POST /api/stage1/select",
        "POST /api/stage2/generate",
        "POST /api/stage2/evaluate",
        "POST /api/stage2/approve",
        "POST /api/stage3/generate",
        "POST /api/stage3/fix-tc",
        "POST /api/stage3/approve",
    ]),
    ("Stages 4–8", [
        "POST /api/stage4/classify",
        "PUT  /api/stage4/override",
        "POST /api/stage4/chat",
        "POST /api/stage7/generate",
        "POST /api/stage7/review",
        "GET  /api/stage7/status/:id",
        "POST /api/stage8/execution/result",
        "POST /api/stage8/approve",
    ]),
    ("Stage 9 + Workflow", [
        "GET  /api/stage9/:workflow_id",
        "POST /api/stage9/generate-qtest-xlsx",
        "POST /api/stage9/generate-iso-docx",
        "POST /api/stage9/qtest-upload",
        "POST /api/stage9/:id/complete",
        "GET  /api/workflows",
        "POST /api/workflows/:id/advance",
        "DELETE /api/workflows/:id",
    ]),
    ("Chat", [
        "POST /api/chat/session",
        "POST /api/chat/send",
        "POST /api/chat/upload",
        "POST /api/chat/session/complete",
        "GET  /api/chat/export/:id",
        "",
        "All endpoints: JWT required",
        "Authorization: Bearer <token>",
    ]),
]

cw = Inches(3.05)
for i, (group, endpoints) in enumerate(api_groups):
    x = Inches(0.3) + i * Inches(3.25)
    add_rect(slide, x, Inches(1.4), cw, Inches(0.4), NAVY)
    add_textbox(slide, group, x + Inches(0.1), Inches(1.44),
                cw - Inches(0.2), Inches(0.32), font_size=12, bold=True, color=WHITE)
    add_rect(slide, x, Inches(1.8), cw, Inches(5.3), WHITE,
             line_color=RGBColor(0xCC,0xCC,0xDD))
    for j, ep in enumerate(endpoints):
        add_textbox(slide, ep, x + Inches(0.12), Inches(1.98) + j * Inches(0.59),
                    cw - Inches(0.24), Inches(0.52), font_size=10,
                    color=TEAL if ep.startswith(("GET","POST","PUT","DELETE")) else DARK_GRAY)

# ═══════════════════════════════════════════════════════════════════════════════
# DIVIDER — Security & Deployment
# ═══════════════════════════════════════════════════════════════════════════════
divider_slide("08", "Security & Deployment", "🔐")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 19 — Security
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Security & Access Control", "OWASP-aligned security practices")

info_card(slide, Inches(0.3), Inches(1.4), Inches(4.0), Inches(5.7),
          "Authentication", [
    "• JWT-based (24-hour tokens)",
    "• bcrypt hashing (salt rounds: 10)",
    "• Token required for all API calls",
    "  except /api/auth/login",
    "• Sliding token expiry on each request",
], font_size=12)

info_card(slide, Inches(4.55), Inches(1.4), Inches(4.0), Inches(5.7),
          "RBAC (Role-Based Access)", [
    "admin role:",
    "• Full access to all workflows",
    "• Delete any workflow",
    "• View all users",
    "• Admin panel access",
    "",
    "user role:",
    "• Own workflows only",
    "• Cannot delete others' workflows",
], font_size=12)

info_card(slide, Inches(8.8), Inches(1.4), Inches(4.2), Inches(5.7),
          "Input Security", [
    "• File uploads: MIME type + extension whitelist",
    "  (.pdf, .docx, .txt, .md, .json, .yaml, images)",
    "• File size limits enforced via multer",
    "• Filenames sanitized (UUID-based storage names)",
    "• SQL injection: parameterized queries only",
    "  (no string concatenation in SQL)",
    "• No secrets in frontend bundle",
    "• All API keys: .env via dotenvx (encrypted)",
    "• Jira + qTest credentials: environment only",
    "• No raw SQL string concatenation anywhere",
], font_size=12)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 20 — Deployment
# ═══════════════════════════════════════════════════════════════════════════════
slide = content_slide("Deployment Architecture", "Production environment details")

info_card(slide, Inches(0.3), Inches(1.4), Inches(6.2), Inches(3.5),
          "Production Server (10.127.26.9)", [
    "• OS: Ubuntu 18.04",
    "• Backend: Node.js 16 (NVM), port 5100, nohup",
    "• Frontend: Static dist (React/Vite build), port 5101",
    "• DB: SQLite at /backend/data/qa_workflow.db",
    "• TCL Repo: /root/exos-tcl-automation/automation/",
    "  (indexed at server startup)",
    "• poppler-utils: pdftoppm for PDF→PNG conversion",
], font_size=12)

info_card(slide, Inches(6.8), Inches(1.4), Inches(6.2), Inches(3.5),
          "Environment Variables", [
    "ANTHROPIC_API_KEY=sk-ant-...",
    "ANTHROPIC_MODEL_HEAVY=claude-opus-4-8",
    "ANTHROPIC_MODEL_LIGHT=claude-sonnet-4-6",
    "JIRA_BASE_URL  |  JIRA_TOKEN  |  JIRA_EMAIL",
    "QTEST_BASE_URL  |  QTEST_TOKEN",
    "JWT_SECRET  |  PORT=5100",
], font_size=12)

info_card(slide, Inches(0.3), Inches(5.05), Inches(6.2), Inches(2.1),
          "Backend Start", [
    "export NVM_DIR=/root/.nvm",
    "source /root/.nvm/nvm.sh",
    "cd /root/networking-qa-workflow/backend",
    "nohup node src/server.js > /tmp/backend.log 2>&1 &",
], font_size=11)

info_card(slide, Inches(6.8), Inches(5.05), Inches(6.2), Inches(2.1),
          "Frontend Build + Deploy (Windows → Server)", [
    "cd frontend ; npm run build",
    "scp -r dist/* root@10.127.26.9:/root/networking-qa-workflow/frontend/dist/",
    "",
    "DB backup: qa_workflow_backup_YYYYMMDD.db",
], font_size=11)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 21 — Summary / Thank You
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, 0, 0, W, H, NAVY)
add_rect(slide, 0, Inches(3.0), W, Inches(0.08), TEAL)
add_rect(slide, 0, Inches(3.08), W, Inches(0.04), ORANGE)

add_textbox(slide, "NOS QA Workflow Tool", Inches(1.0), Inches(0.7),
            Inches(11.3), Inches(0.8), font_size=38, bold=True,
            color=WHITE, align=PP_ALIGN.CENTER)
add_textbox(slide, "Key Takeaways", Inches(1.0), Inches(1.55),
            Inches(11.3), Inches(0.5), font_size=18, color=TEAL, align=PP_ALIGN.CENTER)

takeaways = [
    "Full 7-stage AI-driven workflow: Jira → Skill File → Test Plan → Classification → Scripts → Execution → Report",
    "Claude Opus for generation (depth) + Claude Sonnet for classification/review (speed+cost)",
    "Vision AI for topology PDFs: pdftoppm → PNG → Claude Vision → topology-aware TCs",
    "6-layer quality pipeline: Normalization → Validation → AI Eval → Batch Review → Human Approval → Versioning",
    "3,746 TCL procedures indexed; framework knowledge injected into every AI call for domain accuracy",
    "Multi-table SQLite schema with full version history, audit trail, and cascade-safe operations",
]
for i, t in enumerate(takeaways):
    y = Inches(3.25) + i * Inches(0.57)
    add_rect(slide, Inches(0.6), y + Inches(0.13), Inches(0.08), Inches(0.28), TEAL)
    add_textbox(slide, t, Inches(0.85), y + Inches(0.05),
                Inches(11.6), Inches(0.45), font_size=13, color=WHITE)

add_textbox(slide, "EXOS QA Platform Team  |  July 2026",
            Inches(1.0), Inches(6.85), Inches(11.3), Inches(0.35),
            font_size=12, color=RGBColor(0x77,0x88,0xAA), align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════════════════════════
output_path = r"c:\My_Projects\networking-qa-workflow\NOS_QA_Workflow_Presentation.pptx"
prs.save(output_path)
print(f"✅ Presentation saved: {output_path}")
print(f"   Slides: {len(prs.slides)}")
