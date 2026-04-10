# Mode: analytics — Application Analytics Dashboard

When the candidate asks for analytics, stats, or dashboard, read ALL data sources and generate a comprehensive analytics report.

## Data Sources

1. `data/applications.md` — Tracker with all applications
2. `reports/` — All evaluation reports
3. `output/` — All generated CVs
4. `config/profile.yml` — Target roles and preferences

## Analytics Blocks

### Block 1 — Pipeline Overview
```
Total Evaluated: X
Total Applied:   X (Y%)
Interviews:      X (Y% conversion)
Offers:          X
Rejected:        X
Ghosted:         X (no response after 7+ days)
```

### Block 2 — Match Score Distribution
```
90-100%: ██████ X jobs (STRONG)
70-89%:  ████   X jobs (GOOD)
50-69%:  ███    X jobs (RISKY)
0-49%:   ██     X jobs (SKIP)

Average Score: X%
Median Score:  X%
```

### Block 3 — Conversion Funnel
```
Evaluated (100%) ──→ Applied (X%) ──→ Responded (X%) ──→ Interview (X%) ──→ Offer (X%)
```

### Block 4 — Best Performing Segments
Analyze which types of jobs get the highest scores:
- By role type (Frontend vs Backend vs Full Stack)
- By company size (Startup vs Enterprise)
- By platform (Twine vs LinkedIn vs JobStreet)
- By tech stack required

### Block 5 — Time Analytics
- Average days between Apply → Response
- Average days between Response → Interview
- Which day of week gets most responses
- Ghosting pattern (days before considered ghosted)

### Block 6 — CV Performance (A/B Testing)
Track which CV variants get responses:
```
| CV Variant | Times Used | Responses | Rate |
```

### Block 7 — Actionable Insights
Generate 3-5 specific, actionable recommendations:
- "Focus more on [X] roles — your match rate is Y% higher"
- "Follow up on [company] — it's been Z days"
- "Consider adding [skill] — it appeared in X% of high-match JDs"

### Block 8 — Weekly Trend
```
Week 1: Applied 5, Response 2
Week 2: Applied 8, Response 3
Week 3: Applied 3, Response 1
Trend: ↗️ Response rate improving
```

## Output

Save analytics report to `data/analytics-{YYYY-MM-DD}.md`
Display summary in chat with visual bars and emojis.
