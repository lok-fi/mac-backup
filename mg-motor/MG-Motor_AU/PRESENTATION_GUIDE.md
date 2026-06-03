# MG Motor AU — Network Command Center
## Presentation Guide for Manager & Team

---

## HOW TO USE THIS GUIDE

Each section below maps to one presentation slide or talking block. Use the **"Say this"** lines as your spoken script, the **"Show this"** lines as your live demo cues, and the **"Real example"** callouts to make it concrete and memorable.

---

---

# SLIDE 1 — THE HOOK (30 seconds)

## Title: "What if your entire dealer network could speak to you?"

**Say this:**
> "Right now, MG Motor Australia has 136 dealers spread across every state and territory. Every month, someone manually combs through spreadsheets to figure out who's performing, who's falling behind, and what to do about it. Today I'm showing you what happens when we eliminate that manual work entirely — and replace it with a command center that thinks with you."

**Visual:** Full-screen dashboard on the Executive Overview tab. Dark theme. Brand red accents. Charts alive with data.

---

---

# SLIDE 2 — THE PROBLEM (1 minute)

## Title: "The Old Way Was Costing Us Every Month"

**Say this:**
> "Before this platform, here's what the monthly reporting cycle looked like:
> - Someone exports raw data into Excel
> - Someone else formats it into a scorecard — manually, sheet by sheet
> - It gets emailed as a static PDF
> - By the time leadership sees it, the data is already old
> - If anyone wants to ask a follow-up question — 'Which dealers in Victoria are below 80% achievement?' — they go back to Excel, pivot, filter, wait
>
> That cycle takes days. And the insights it produces are backward-looking snapshots, not live intelligence."

**Visual:** Simple before/after. Left: Excel grid, email chain. Right: the dashboard.

---

---

# SLIDE 3 — THE SOLUTION (1 minute)

## Title: "MG Motor AU Network Command Center"

**Say this:**
> "This is a full-stack, AI-powered dealer analytics platform built specifically for MG Motor Australia. It ingests the same Excel scorecards that already exist — nothing changes on the data side — and transforms them into a living, interactive intelligence layer for the entire network."

**Key numbers to call out:**
- **136+ dealers** tracked in real time
- **5 performance dimensions** per dealer: Sales, Market Share, Parts/Aftersales, CX, Google Reviews
- **10+ chart types** across 5 analytical tabs
- **AI assistant** that understands the data and takes actions on voice command
- **Automated email reporting** with PDF capture

---

---

# SLIDE 4 — ARCHITECTURE IN ONE SENTENCE (30 seconds)

## Title: "Modern, Serverless, and Built to Scale"

**Say this:**
> "The platform runs on Zoho Catalyst — a serverless cloud platform — with a React frontend and a Node.js API layer. All data lives in the Catalyst Data Store. The AI layer is powered by Google Gemini. Authentication is enterprise-grade OAuth through Catalyst's built-in identity service."

```
Excel Scorecard
      ↓
  Upload UI  →  Node.js API  →  Catalyst Data Store
                     ↓
               React Dashboard  ←→  Gemini AI
                     ↓
              Role-Based Users
             (Admin / Dealer)
```

**Why this matters:** No servers to manage. No databases to maintain. Scales automatically. Pay per use.

---

---

# SLIDE 5 — FEATURE WALKTHROUGH: EXECUTIVE OVERVIEW (2 minutes)

## Title: "The First Thing Leadership Sees Every Morning"

**Say this:**
> "The Executive Overview tab is designed for one purpose: give leadership a network-wide health read in under 30 seconds."

### Feature 1 — Network Health Radar
> "This radar chart plots five key metrics simultaneously: Sales Achievement, Parts Achievement, Market Share, Google Ratings, and CX Health. One shape tells you everything. A bloated shape means the network is firing on all cylinders. A dented corner means 'here's where we have a problem.'"

**Real example:**
> "Imagine it's the end of March. The radar shows Sales at 94%, but CX Health is at 62%. That's your conversation starter in the leadership meeting — without anyone having to run a single filter."

---

### Feature 2 — Top 12 Dealers by Sales (Composed Chart)
> "This bar + line chart shows actual sales in red against the monthly target as a line. Every bar is color-coded: green for dealers who hit target, amber for 80–99%, red for below 80%. You can see at a glance which dealers are carrying the network and which ones need intervention."

---

### Feature 3 — Sales Achievement Distribution (Pie Chart)
> "This pie answers the executive question: 'How healthy is the network overall?' It breaks the 136 dealers into four bands — green, amber, orange, red. If 70% of your network is in the green band, that's a great month. If you're seeing a shift toward amber and red, that's the early warning signal."

---

### Feature 4 — Regional Breakdown (Progress Bars)
> "Five regions — NSW, VIC, QLD, WA, SA/NT — each showing a visual progress bar of sales performance. Instantly see if one region is dragging the national average."

---

---

# SLIDE 6 — FEATURE WALKTHROUGH: SALES & MARKET TAB (1.5 minutes)

## Title: "From Network Overview to Dealer-Level Accountability"

**Say this:**
> "When you need to drill in — who exactly is performing and who isn't — you go to the Sales & Market tab."

### Feature 5 — Achievement Rate Leaderboard
> "Top 12 dealers ranked by sales achievement percentage, shown as vertical bars. The color bands make it immediate — no numbers needed to spot the outliers."

### Feature 6 — Bottom 10 Dealers
> "This is the accountability view. These are the dealers that need attention this month. A sales manager can open this on Monday morning and have their call list ready before their first coffee."

**Real example:**
> "Say Metro Honda in QLD is consistently in the bottom 10 for three months running. You can pull their trend, see their market share, check if it's a stock issue or a performance issue — all within the same dashboard, no pivot table required."

### Feature 7 — Market Share Breakdown
> "MG's share vs. total market registrations by dealer. This tells you if a dealer is in a high-competition market or if MG's share in that territory is genuinely weak."

---

---

# SLIDE 7 — FEATURE WALKTHROUGH: AFTERSALES & CX TAB (1.5 minutes)

## Title: "The Revenue Stream Nobody Talks About Enough"

**Say this:**
> "Parts and aftersales revenue is a critical long-term health signal for any dealership network. The CX tab tracks both."

### Feature 8 — Parts Revenue Top 12 (Composed Chart)
> "Same format as sales — bars for actuals, a line for targets. Parts revenue is where dealer profitability is built. A dealer can hit their new car sales target but miss parts by 40% and still be unhealthy."

### Feature 9 — CX Compliance Pie
> "This tracks four CX compliance pillars per dealer: Response Rate, Customer Score, Lead Time, and Training. The pie shows how many dealers are passing all four, three, two, one, or none. A dealer passing all four gets a green status. Below that, you're flagging for coaching."

**Real example:**
> "If 35% of your dealers are only passing 2 out of 4 CX checks, that's a systemic training gap — not a dealer problem. This view makes that structural insight visible."

---

---

# SLIDE 8 — FEATURE WALKTHROUGH: NETWORK & GOOGLE TAB (1 minute)

## Title: "Brand Reputation Is Now a Metric"

**Say this:**
> "Google Reviews are not soft data. They are measurable, trackable, and directly tied to foot traffic. This tab turns review scores into a competitive intelligence layer."

### Feature 10 — Google Rating Scatter Plot
> "X-axis: number of reviews. Y-axis: star rating. Each bubble is a dealer. The dealers in the top-right quadrant — high reviews, high score — are your brand champions. Dealers in the bottom-left have low visibility AND a reputation problem."

### Feature 11 — Corporate Identity (CI) Status
> "CI tracks whether dealers meet MG's physical brand standards — signage, showroom setup, marketing compliance. It's scored out of 100 points. The pie shows compliance distribution; the leaderboard shows top 10 performers."

---

---

# SLIDE 9 — FEATURE WALKTHROUGH: DOTY LEADERBOARD (1 minute)

## Title: "Dealer of the Year — Gamified for Performance"

**Say this:**
> "The DOTY tab turns performance data into a competitive leaderboard. Every dealer sees a stacked bar showing their points across four categories: Sales, Aftersales, Google, and CI. The top three get medal status — gold, silver, bronze."

**Real example:**
> "Publicly showing this leaderboard in dealer meetings changes behaviour. When a dealer sees they're 12 points behind second place and it's only October, they know exactly what they need to do. It's not a report — it's a motivational tool."

---

---

# SLIDE 10 — THE AI LAYER (3 minutes — the showstopper)

## Title: "This Dashboard Doesn't Just Display Data. It Thinks."

**Say this:**
> "This is the part that makes this platform fundamentally different from any other reporting tool in use today."

---

### Feature 12 — AI Text Chat (Streaming)

> "You can type any question about the dealer network and get a live, streaming answer grounded in the actual data. Not a generic AI response — one that knows your 136 dealers, their targets, their regions, and their monthly numbers."

**Real example — say this live:**
> Type into the AI chat: *"Which dealers in Victoria are below 80% sales achievement this month?"*

> The AI streams back a table with dealer names, actual vs target, and achievement %. No filter, no pivot, no formula. Ask and receive.

---

### Feature 13 — AI Dashboard Actions (Autonomous Navigation)

> "The AI doesn't just answer questions. It controls the dashboard. When you ask it a question that's better shown visually, it switches tabs, applies region filters, and generates the right chart — automatically."

**Real example:**
> Type: *"Show me the top 10 DOTY performers in Queensland"*
>
> The AI: switches to the DOTY tab, filters to QLD, and highlights the top performers. You didn't touch a single filter.

---

### Feature 14 — AI Insights Tab (Dynamic Chart Builder)

> "The AI Insights tab is a natural-language chart builder. Ask for any slice of the data and it generates a live visualization: bar chart, pie chart, scatter, KPI cards, or a table. You can pin these generated charts to the Overview tab so they persist for your team."

**Real example:**
> *"Compare parts achievement across all regions as a bar chart"*
>
> Instant: a grouped bar chart with all 5 regions, sorted by achievement. Pin it. It stays on your overview every time you open the dashboard.

---

### Feature 15 — Voice Control (Gemini Live)

> "You can speak to this dashboard. In Live Mode, the AI listens continuously, processes your question using Google's Gemini Live API with a natural voice (Zephyr), and responds audibly while also taking action on screen. In Mic-to-Type mode, one tap transcribes your voice into the chat box."

**Real example — say this in the presentation:**
> "Imagine you're in a boardroom presenting. You can say: 'Switch to the Network tab and show me dealers with a Google rating below 4 stars.' The dashboard responds. No keyboard. No mouse. Pure voice control."

**This is not a gimmick. This is the future of executive reporting.**

---

### Feature 16 — Email Reports with PDF Capture

> "From the dashboard, you can send a report email to any recipient. The system captures the current dashboard state as a high-resolution PDF and attaches it to the email automatically. One click to share the full network performance snapshot."

---

---

# SLIDE 11 — DATA INGESTION (1 minute)

## Title: "Zero Change to Your Existing Data Process"

**Say this:**
> "Here's what nobody had to change: the Excel scorecard format. The same file MG Motor has always used — with sheets for Sales, Market Share, Stock, Parts, Service CX, Google Reviews, CI, and DOTY — gets uploaded through a simple drag-and-drop UI."

**How it works:**
1. Upload the Excel file
2. The system auto-detects the month (e.g., Mar-25)
3. It runs a **Quality Check Report** — shows coverage % for each data category
4. You confirm, and it's stored in the cloud
5. The dashboard updates instantly

> "You can also upload multiple months at once and the system builds a historical view and annual averages automatically."

---

---

# SLIDE 12 — SECURITY & ACCESS CONTROL (30 seconds)

## Title: "Role-Based, Enterprise-Grade Access"

**Say this:**
> "Authentication is handled by Zoho Catalyst's OAuth layer — the same infrastructure used in enterprise SaaS. Two roles exist: **Admin** (full access, user management, data upload) and **Dealer** (read-only view of their own data). No passwords to manage. No security risk from shared spreadsheets."

---

---

# SLIDE 13 — VS POWER BI (2 minutes — critical differentiator)

## Title: "Why Not Just Use Power BI?"

**Say this:**
> "This is the question I expected, so let me answer it directly."

| Dimension | Power BI On-Demand | This Platform |
|-----------|-------------------|---------------|
| **AI Assistant** | None (Q&A feature is basic) | Full Gemini LLM — natural language, streaming, autonomous actions |
| **Voice Control** | None | Gemini Live — continuous voice, spoken responses |
| **Deployment** | Microsoft 365 subscription required per user | Web app, any browser, any device — zero client install |
| **Customisation** | Template-constrained | Every pixel, every metric, every color is MG-branded and purpose-built |
| **Data model** | Requires Power Query setup per new field | Built for MG's scorecard structure — understands dealer/region/month natively |
| **Dynamic chart generation** | Pre-built visuals only | AI generates new charts on demand from natural language |
| **Cost at scale** | Per-user licensing ($10–$20/user/month) | Serverless — pay per API call, not per seat |
| **Dashboard actions from AI** | Not possible | AI switches tabs, applies filters, builds charts autonomously |
| **Offline PDF report email** | Manual export + email | One-click automated PDF email distribution |
| **DOTY Leaderboard logic** | Custom DAX needed, no gamification | Built-in with medals, stacked bar, category breakdowns |

**Summary:**
> "Power BI is a great general-purpose BI tool. This platform is a purpose-built, AI-native command center for MG Motor's dealer network. Power BI shows you what happened. This platform helps you understand it, act on it, and communicate it — in real time, with your voice if you want."

---

---

# SLIDE 14 — FUTURE ROADMAP (2 minutes)

## Title: "What's Next — The 12-Month Vision"

**Say this:**
> "The platform is production-ready today. But the architecture was designed for what comes next."

---

### Roadmap Item 1 — Headless Architecture

> "Right now the frontend and backend are coupled — one React app, one API. The next evolution is a **headless API layer**: the same data and AI logic exposed as clean REST/GraphQL endpoints that any surface can consume."

**What this unlocks:**
- Embed dealer scorecards inside the existing MG dealer portal
- Power a **mobile app** (iOS/Android) without rebuilding the backend
- Feed data into **third-party tools** (Slack bots, Teams tabs, CRM integrations)
- Let dealer groups build their **own custom views** on top of the same data

---

### Roadmap Item 2 — Predictive AI (Forecasting)

> "We currently have 12+ months of historical dealer data. The next AI layer uses that history to **predict** next month's performance. Gemini can flag: 'Dealer X is trending toward a missed target — here's why, based on 8 months of patterns.' Proactive intervention instead of reactive reporting."

---

### Roadmap Item 3 — Live CRM Integration (Salesforce / Zoho CRM)

> "Connect the dashboard to the CRM so that when a dealer is flagged as underperforming, a **follow-up task is automatically created** for the area manager in Salesforce or Zoho CRM. Close the loop from insight to action without leaving the system."

---

### Roadmap Item 4 — WhatsApp / SMS Dealer Alerts

> "For dealers who don't open dashboards, push the key metric directly to them. Every month-end, an automated WhatsApp or SMS message: 'Your sales achievement is 74% — you're 6 units from your target.' Powered by the same backend, no extra infra."

---

### Roadmap Item 5 — Dealer Self-Service Portal

> "Currently dealers are read-only viewers. The roadmap includes a **dealer-facing interface** where each dealer sees only their own performance, can log action plans against flagged metrics, and can view how they rank on the DOTY leaderboard against their region — not the whole network."

---

### Roadmap Item 6 — Automated Anomaly Detection

> "The AI layer monitors data as it's uploaded and proactively surfaces anomalies: a dealer's Google score dropped 0.4 stars in one month, parts revenue is 50% below the last 3-month average, a CX pillar went from Pass to Fail. These become instant alerts — not things you find when you look."

---

### Roadmap Item 7 — Multi-Brand / Multi-Market Extension

> "The architecture is brand-agnostic. The same platform could power dealer analytics for any automotive brand. If MG Motor expands to New Zealand as a larger network or adds new brands under the same group, the platform extends horizontally — same infrastructure, new data source, new dashboard skin."

---

---

# SLIDE 15 — BUSINESS VALUE SUMMARY (1 minute)

## Title: "What This Is Really Worth"

**Say this:**
> "Let me put this in business terms."

| What we replaced | What we gained |
|-----------------|---------------|
| Days of manual Excel work monthly | Instant upload → live dashboard |
| Static PDF reports emailed to leadership | Interactive, filterable, voice-navigable intelligence |
| Reactive problem discovery (after the month closes) | In-month visibility with AI anomaly alerts (roadmap) |
| Analyst time to answer ad-hoc questions | Natural language AI that answers in seconds |
| Generic BI licensing costs per seat | Serverless — cost scales with usage, not headcount |
| Fragmented dealer communication | One platform, role-based access, automated reports |

> "The question isn't 'is this worth building?' — it's already built. The question is: how fast do we roll it out and what do we add next?"

---

---

# SLIDE 16 — CLOSING (30 seconds)

## Title: "This is MG Motor AU's Data Infrastructure for the Next 5 Years"

**Say this:**
> "What you've seen today isn't a prototype. It's a production system handling 136 dealers, multiple months of historical data, real-time AI, and enterprise authentication. The foundation is solid. The roadmap is clear. And the competitive advantage is significant."

> "I'd like to walk you through a live demo now — and I'm happy to take any questions."

---

---

# DEMO SCRIPT (5 minutes — follow this order)

**Step 1 — Open the dashboard**
> "Let me start from the Executive Overview tab. Notice the Network Health Radar in the top left. This is the pulse of the entire network at a glance."

**Step 2 — Switch to Sales & Market tab**
> "Here's the leaderboard view — top performers in green, bottom 10 in red. This is what a sales manager sees on Monday morning."

**Step 3 — Switch to DOTY tab**
> "Here's the gamification layer — the Dealer of the Year leaderboard. Gold, silver, bronze. This drives competitive behaviour across the network."

**Step 4 — Open the AI Insights tab**
> "Now watch this. I'm going to ask the AI a question about the data."
> Type: *"Which region has the highest average parts achievement?"*
> Let it stream. Show the answer. Show the chart it generates.

**Step 5 — Use Voice**
> "Now I'm going to use my voice."
> Click the microphone. Say: *"Show me the top 5 Google-rated dealers."*
> Let the AI respond and take action on screen.

**Step 6 — Send an email report**
> "One more thing — I can send a PDF report right now from this screen. One click."

---

---

# APPENDIX — TECH STACK QUICK REFERENCE

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, Recharts 3 |
| Styling | Inline React styles, MG brand palette |
| Backend | Node.js, Express 5, Zoho Catalyst Functions |
| Database | Zoho Catalyst Data Store (NoSQL) |
| AI | Google Gemini 2.0 Flash, Gemini Live (voice) |
| Auth | Zoho Catalyst OAuth (role-based) |
| Email | Nodemailer via Gmail SMTP |
| PDF Export | html2canvas + jsPDF |
| Data Ingestion | XLSX.js (Excel parsing) |
| Hosting | Zoho Catalyst (serverless, auto-scaling) |

---

---

# APPENDIX — QUESTIONS YOU MIGHT GET

**Q: What happens if the Excel format changes?**
> "The parser in the backend is modular — each sheet (Sales, Parts, CX, etc.) has its own parsing logic. Updating it for a new format is a targeted change, not a rebuild."

**Q: Can dealers access their own data?**
> "Yes — role-based access is already built in. Dealers get a read-only view. The dealer self-service portal with action plans is on the roadmap."

**Q: Is the AI making things up?**
> "No — the AI is given the actual dealer data as context with every query. It reasons over real numbers, not hallucinated ones. It's grounded in the same dataset you see in the charts."

**Q: What's the cost to run this?**
> "Zoho Catalyst pricing is pay-per-execution on functions, plus flat storage. At MG's scale, the monthly infra cost is a fraction of one analyst's monthly salary. The AI API calls (Gemini) are similarly low-cost at this query volume."

**Q: Can this be white-labelled for other brands?**
> "Yes — the codebase is parameterised around MG's brand palette and data structure. Adapting it for another automotive brand is a weeks-long project, not a rebuild."

**Q: How secure is the data?**
> "Data is stored in Zoho Catalyst's cloud (SOC 2 compliant). Authentication is OAuth-based — no passwords stored by the application. Role-based access ensures dealers can only see their own data."

---

*Presentation guide prepared for MG Motor AU Network Command Center — May 2026*
