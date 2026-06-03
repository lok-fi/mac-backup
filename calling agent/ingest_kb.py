"""
Run once (or whenever your docs change) to populate the knowledge base.
Usage:  python ingest_kb.py
"""
from knowledge_base import KnowledgeBase


def main():
    kb = KnowledgeBase()

    documents = [
        # ── Company Overview ────────────────────────────────────────────────────
        {
            "id": "tl-overview",
            "text": (
                "TeamLease Services is one of India's largest staffing and HR services companies, "
                "founded in 2002 and headquartered in Bengaluru. "
                "TeamLease employs over 2.5 lakh associates across India, working at more than 3,500 client companies. "
                "TeamLease is listed on BSE and NSE."
            ),
            "metadata": {"category": "company"},
        },
        # ── Services ───────────────────────────────────────────────────────────
        {
            "id": "tl-services",
            "text": (
                "TeamLease offers the following services:\n"
                "1. Contract Staffing — employees on TeamLease payroll, working at client sites under client supervision.\n"
                "2. Apprenticeship Services — hiring, managing, and deploying apprentices under the Apprentices Act 1961.\n"
                "3. Core / Permanent Hiring — end-to-end permanent recruitment for all levels.\n"
                "4. Payroll & Compliance Management — outsourced payroll processing, statutory compliance (PF, ESI, PT, LWF, TDS).\n"
                "5. Compliance Software (TeamLease RegTech) — SaaS platform for labour law compliance tracking.\n"
                "6. HRMS — cloud-based Human Resource Management System for attendance, leaves, and employee lifecycle.\n"
                "7. Learning Solutions — skilling, upskilling, and training programs for associates and employees."
            ),
            "metadata": {"category": "services"},
        },
        # ── Contract Staffing Detail ────────────────────────────────────────────
        {
            "id": "tl-contract-staffing",
            "text": (
                "Contract Staffing (Flexi Staffing): "
                "The associate is on TeamLease's payroll — TeamLease handles salary disbursement, PF, ESI, and all statutory compliance. "
                "The associate works full-time at the client's location under the client's supervision. "
                "Clients can request either to transfer existing employees onto TeamLease's payroll "
                "or to have TeamLease hire and deploy fresh talent. "
                "Minimum engagement is typically 3 months. "
                "Available across sectors: BFSI, retail, telecom, logistics, manufacturing, pharma, IT/ITeS, e-commerce, FMCG."
            ),
            "metadata": {"category": "contract_staffing"},
        },
        # ── Apprenticeship ─────────────────────────────────────────────────────
        {
            "id": "tl-apprenticeship",
            "text": (
                "TeamLease Apprenticeship Services helps companies hire apprentices under the Apprentices Act 1961. "
                "TeamLease manages end-to-end compliance: registration on the NAPS/NAPS portal, stipend disbursement, "
                "training tracking, and government compliance. "
                "Apprentices cost 20-30% less than contract staff and attract government incentives. "
                "Sectors: manufacturing, retail, logistics, hospitality, BFSI."
            ),
            "metadata": {"category": "apprenticeship"},
        },
        # ── Payroll & Compliance ────────────────────────────────────────────────
        {
            "id": "tl-payroll",
            "text": (
                "TeamLease Payroll & Compliance Management: "
                "Fully outsourced payroll processing covering salary computation, statutory deductions (PF, ESI, PT, LWF, TDS), "
                "payslip generation, Form 16, and all government filings. "
                "Available as standalone payroll or bundled with compliance management. "
                "Supports companies from 10 to 50,000+ employees."
            ),
            "metadata": {"category": "payroll"},
        },
        # ── Compliance Software ─────────────────────────────────────────────────
        {
            "id": "tl-regtech",
            "text": (
                "TeamLease RegTech is a SaaS compliance management platform. "
                "It covers 1,500+ Acts and 20,000+ compliances across central and state labour laws. "
                "Features: compliance calendar, automated reminders, digital document storage, audit trail, "
                "and a dedicated compliance manager. "
                "Used by 1,000+ companies including large enterprises and mid-market firms."
            ),
            "metadata": {"category": "compliance_software"},
        },
        # ── Contact & Escalation ────────────────────────────────────────────────
        {
            "id": "tl-contact",
            "text": (
                "TeamLease contact information:\n"
                "Website: www.teamlease.com\n"
                "General enquiries: info@teamlease.com\n"
                "Associates / employees with queries: info@teamlease.com or the TeamLease mobile app chatbot.\n"
                "Job seekers: visit teamlease.com for the latest openings.\n"
                "Registered office: 6th Floor, BMTC Commercial Complex, 80 Feet Road, Koramangala, Bengaluru – 560095."
            ),
            "metadata": {"category": "contact"},
        },
        # ── Geographies ────────────────────────────────────────────────────────
        {
            "id": "tl-geography",
            "text": (
                "TeamLease operates pan-India with offices and associate presence in all major cities: "
                "Bengaluru, Mumbai, Delhi NCR, Chennai, Hyderabad, Pune, Kolkata, Ahmedabad, Jaipur, Lucknow, "
                "Chandigarh, Bhubaneswar, Kochi, Coimbatore, Nagpur, and 200+ Tier-2 and Tier-3 locations. "
                "TeamLease can deploy staff in any location across India."
            ),
            "metadata": {"category": "geography"},
        },
    ]

    kb.ingest(documents)
    print("TeamLease knowledge base ready.")


if __name__ == "__main__":
    main()
