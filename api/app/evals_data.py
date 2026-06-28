"""Curated retrieval eval set + guardrail examples for the trust page.

Each eval pairs a question with the source passage that should ground the
answer. The trust page runs these against the live retriever, so the results
reflect real behaviour — not a recording.
"""

EVAL_SET: list[dict] = [
    {
        "question": "What dollar amount triggers a mandatory transaction monitoring alert?",
        "expected_slug": "aml-policy",
        "expected_section": "Transaction Monitoring",
    },
    {
        "question": "How long must compliance records be retained?",
        "expected_slug": "aml-policy",
        "expected_section": "Record Keeping",
    },
    {
        "question": "Within how many days must a suspicious activity report be filed?",
        "expected_slug": "aml-policy",
        "expected_section": "Suspicious Activity Reporting",
    },
    {
        "question": "When is enhanced due diligence required for politically exposed persons?",
        "expected_slug": "kyc-procedure",
        "expected_section": "Enhanced Due Diligence",
    },
    {
        "question": "What refund amount can a front-line agent approve without escalation?",
        "expected_slug": "refunds-policy",
        "expected_section": "Approval Thresholds",
    },
    {
        "question": "What is the deadline to respond to a chargeback dispute?",
        "expected_slug": "refunds-policy",
        "expected_section": "Chargebacks and Disputes",
    },
    {
        "question": "Can sensitive authentication data like the CVV be stored after authorization?",
        "expected_slug": "pci-checklist",
        "expected_section": "Do Not Store",
    },
    {
        "question": "How often must penetration testing be performed?",
        "expected_slug": "pci-checklist",
        "expected_section": "Penetration Testing",
    },
]

# Questions the corpus does not cover — the guardrail should decline these.
GUARDRAIL_EXAMPLES: list[str] = [
    "What is the penalty for insider trading?",
    "How many vacation days do employees get?",
]
