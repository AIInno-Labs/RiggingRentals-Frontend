"""Additive SOW update: Super Admin Ops Command Center + hours on OneDrive base."""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


BASE = Path(r"c:\src\RiggingRentalMVP\docs\_sow_rr_base.docx")
OUT_DOCS = Path(r"c:\src\RiggingRentalMVP\docs\SOW-Equipment-Rental-Platform for RR.docx")
OUT_ONEDRIVE = Path(r"c:\Users\shuvi\OneDrive\Documents\SOW-Equipment-Rental-Platform for RR.docx")


def set_run_text(paragraph: Paragraph, text: str) -> None:
    """Replace paragraph text while keeping the first run's formatting when possible."""
    if paragraph.runs:
        paragraph.runs[0].text = text
        for run in paragraph.runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(text)


def insert_paragraph_after(paragraph: Paragraph, text: str, style: str | None = None) -> Paragraph:
    new_p = deepcopy(paragraph._p)
    # Clear content of cloned paragraph
    for child in list(new_p):
        if child.tag == qn("w:r") or child.tag == qn("w:hyperlink"):
            new_p.remove(child)
    paragraph._p.addnext(new_p)
    new_para = Paragraph(new_p, paragraph._parent)
    if style:
        new_para.style = style
    elif paragraph.style:
        new_para.style = paragraph.style
    new_para.add_run(text)
    return new_para


def find_para(doc: Document, exact: str) -> Paragraph:
    for p in doc.paragraphs:
        if p.text.strip() == exact:
            return p
    raise KeyError(exact)


def find_para_startswith(doc: Document, prefix: str) -> Paragraph:
    for p in doc.paragraphs:
        if p.text.strip().startswith(prefix):
            return p
    raise KeyError(prefix)


def set_table_cell(table, row: int, col: int, text: str) -> None:
    cell = table.rows[row].cells[col]
    # First paragraph in cell
    p = cell.paragraphs[0]
    set_run_text(p, text)
    # Clear extra paragraphs if any leftover noise
    for extra in cell.paragraphs[1:]:
        set_run_text(extra, "")


def main() -> None:
    doc = Document(str(BASE))

    # §2 — Super Admin Ops Command Center wording
    p_mgr = find_para(
        doc,
        "Managers see live utilisation and attention items on an operations dashboard.",
    )
    set_run_text(
        p_mgr,
        "Super Admin sees live utilisation, revenue, shop aging, and attention items on the Ops Command Center.",
    )

    # §4.2 — append Super Admin role bullet after existing roles bullet
    p_roles = find_para(
        doc,
        "Roles: Administrator, Sales, Workshop, Finance (admins can access across portals)",
    )
    insert_paragraph_after(
        p_roles,
        "Super Admin (Yard control): cross-portal access (Sales, Yard, Workshop, Finance), fleet and certificate authority, and the Ops Command Center as home — so one login can see blockers and act without switching accounts.",
        style="List Bullet",
    )

    # §4.16 — expand Operations dashboard into Super Admin Ops Command Center
    p416 = find_para(doc, "4.16 Operations dashboard")
    set_run_text(p416, "4.16 Super Admin Ops Command Center & analytics")

    p416_body = find_para(
        doc,
        "Fleet utilisation, pipeline view, and needs-attention queue (certs, credit stops, overdue AR, hires ending soon)",
    )
    set_run_text(
        p416_body,
        "Pulse tiles for today’s blockers: critical issues (expired certs, parts holds, pickups), shop stuck 7d+, AR at risk, fleet on hire / utilisation, and open pipeline.",
    )

    bullets_416 = [
        "Insights charts: billed revenue by week, invoice mix, fleet and hire-pipeline composition, demand vs downtime, shop aging by week opened, top customers by billed revenue, and revenue by equipment.",
        "Needs-you attention queue with click-through to certs, shop, logistics, billing, and sales follow-ups — one place to prioritise the day.",
        "Cross-desk shortcuts to Pipeline, Workshop, Logistics, and Billing without role-switching.",
        "Fleet authority: catalogue / serial / certificate admin, plus expired-certificate dispatch override when operations require Super Admin intervention.",
        "Makes the Super Admin’s life easy: answers “what sold, what’s stuck in the bay, who owes, and what’s down” without spreadsheets or chasing each desk.",
    ]
    anchor = p416_body
    for text in bullets_416:
        anchor = insert_paragraph_after(anchor, text, style="List Bullet")

    # New §4.17 — Where Super Admin is needed; renumber Quality to 4.18
    p_quality = find_para(doc, "4.17 Quality, training & go-live")
    set_run_text(p_quality, "4.18 Quality, training & go-live")

    # Insert 4.17 heading + bullets immediately before 4.18
    # Insert in reverse order before quality using previous sibling inserts
    # Better: insert after last 4.16 bullet (anchor), then quality stays after
    # But quality is currently right after old 4.16 body in document order.
    # After our inserts, anchor is last 4.16 bullet; quality heading still follows original body position...
    # Document order: 4.16 heading, body, [new bullets], 4.17 quality
    # We need 4.17 section between last bullet and quality.
    # Current quality is still after original body in XML — our inserts were after body,
    # so order is: body, new bullets..., then whatever was after body originally = quality.
    # So inserting after `anchor` (last new bullet) puts 4.17 before quality. Perfect.

    h417 = insert_paragraph_after(
        anchor,
        "4.17 Where Super Admin is needed",
        style="Heading 2",
    )
    sa_bullets = [
        "Day-to-day hire still runs Sales → Workshop → Finance. Super Admin is not required on every quote or dispatch.",
        "Super Admin is needed for yard identity (models, serials, certificates), multi-desk exceptions, expired-cert overrides, and go-live / KPI oversight.",
        "When something spans desks — stock blocked by certs, shop backlog hitting sales promises, AR risk while gear is still out — Super Admin uses the Ops Command Center to decide who acts next.",
        "One secure login, one attention queue, and live analytics replace hunting through email and spreadsheets to keep hire moving.",
    ]
    a = h417
    for text in sa_bullets:
        a = insert_paragraph_after(a, text, style="List Bullet")

    # Milestone table (table index 1) + investment summary (table index 4)
    milestones = doc.tables[1]
    # Row 4 = Staff application (0-based header at 0)
    set_table_cell(
        milestones,
        4,
        1,
        "Sales, Workshop, Finance & Ops screens in the web app, including Super Admin Ops Command Center & analytics",
    )
    set_table_cell(milestones, 4, 2, "180")
    set_table_cell(milestones, 7, 2, "688")

    invest = doc.tables[4]
    set_table_cell(invest, 1, 1, "688")
    set_table_cell(invest, 4, 1, "1,458")

    OUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT_DOCS))
    print(f"Wrote {OUT_DOCS}")

    try:
        doc.save(str(OUT_ONEDRIVE))
        print(f"Wrote {OUT_ONEDRIVE}")
    except Exception as exc:  # noqa: BLE001
        print(f"OneDrive write skipped: {exc}")


if __name__ == "__main__":
    main()
