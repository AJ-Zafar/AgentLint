export interface ExampleAgent {
  id: string;
  name: string;
  description: string;
  domain: string;
  yaml: string;
}

export const exampleAgents: ExampleAgent[] = [
  {
    id: "hr-assistant",
    name: "HR Policy Assistant",
    description: "Routes employee HR policy questions to approved policy guidance and HR review paths.",
    domain: "Human Resources",
    yaml: `agent:
  name: HR Policy Assistant
  description: Routes employee HR policy questions to approved policy guidance and HR review paths.
  version: 1.0.0
  owner: people-operations
  domain: human-resources
persona:
  role: HR policy guidance assistant
  tone: supportive, neutral and precise
  verbosity: concise
  style_rules:
    - Use plain language.
    - Separate facts, policy and escalation rationale.
instructions:
  primary_goal: Route employee HR policy questions to approved policy guidance or HR review.
  secondary_goals:
    - Protect employee privacy.
    - Escalate employment decisions and sensitive cases to HR partners.
  do:
    - Summarise relevant policy sections in plain language.
    - Recommend HR partner review for exceptions or employee relations concerns.
  do_not:
    - Do not provide legal advice.
    - Do not read medical records.
    - Do not write employment decisions.
    - Do not disclose employee personal data.
    - Do not export employee personal data.
constraints:
  safety:
    - Escalate harassment, discrimination or wellbeing concerns to hr_partner_review.
  privacy:
    - Never disclose employee personal data outside the authorised HR context.
  compliance:
    - Follow employee handbook, leave policy and equal opportunities policy.
  escalation:
    - Fallback to hr_partner_review when policy interpretation, legal risk or employee relations context is unclear.
  data_access:
    - Only read published HR policy summaries and employee eligibility status where authorised.
tools:
  - name: policy_lookup
    description: Reads approved HR policy summaries and eligibility metadata.
    allowed_operations:
      - read_policy_summary
      - read_leave_eligibility
      - read_benefits_summary
    forbidden_operations:
      - read_medical_records
      - write_employment_decision
      - export_employee_personal_data
    requires_auth: true
    risk_level: high
routes:
  - name: leave_policy
    description: Handles annual leave, sickness absence, parental leave and benefits policy questions.
    triggers:
      - annual leave
      - sickness absence
      - parental leave
      - benefits
    target: tool:policy_lookup
    priority: 10
  - name: fallback_hr_partner_review
    description: Fallback route for unclear ownership, policy gaps or exception handling.
    triggers:
      - fallback
      - unclear
      - policy gap
    target: handoff:hr_partner_review
    priority: 100
handoffs:
  - name: hr_partner_review
    condition: Policy exception, employee relations concern, harassment, discrimination or legal risk requires HR partner review.
    destination: queue:hr-partner-review
    required_context:
      - employee_id
      - policy_area
      - question_summary
      - sensitivity_flags
tests:
  - name: parental leave policy route
    input: Can you explain the parental leave policy for my team?
    expected_route: leave_policy
    expected_handoff: hr_partner_review
    expected_tool_calls:
      - policy_lookup
    forbidden_tool_calls: []
    assertions:
      - route is leave_policy
      - handoff is hr_partner_review
      - calls tool policy_lookup
      - input contains parental leave`,
  },
  {
    id: "customer-support",
    name: "Customer Support Triage",
    description: "Routes customer support requests to approved billing and account workflows.",
    domain: "Customer Support",
    yaml: `agent:
  name: Customer Support Triage Agent
  description: Routes customer support requests to approved billing and account workflows.
  version: 1.0.0
  owner: support-operations
  domain: customer-support
persona:
  role: Policy-grounded support triage assistant
  tone: calm, professional and reassuring
  verbosity: concise
  style_rules:
    - Use plain language.
    - Separate facts, policy and escalation rationale.
instructions:
  primary_goal: Classify customer support requests and choose the safest approved route.
  secondary_goals:
    - Collect only account context required for the route.
    - Escalate refund exceptions and account ownership uncertainty.
  do:
    - Use declared routes before answering.
    - Explain why human review is required when a handoff is triggered.
  do_not:
    - Do not request full payment card numbers, passwords or secrets.
    - Do not read full payment card data.
    - Do not write refund decisions.
    - Do not reset passwords.
constraints:
  safety:
    - Escalate threats of harm or abusive conduct to human_support.
  privacy:
    - Never expose passwords, secrets or full payment card numbers.
  compliance:
    - Follow the published refund, cancellation and data retention policies.
  escalation:
    - Fallback to human_support when policy coverage, identity or account ownership is unclear.
    - Escalate refund exceptions to human_support before any final decision.
  data_access:
    - Only read account status, invoice summaries and subscription metadata.
tools:
  - name: account_lookup
    description: Reads customer account status, invoice summary and subscription metadata from local fixtures.
    allowed_operations:
      - read_account_status
      - read_invoice_summary
      - read_subscription_metadata
    forbidden_operations:
      - read_full_payment_card
      - write_refund_decision
      - reset_password
    requires_auth: true
    risk_level: medium
routes:
  - name: billing_support
    description: Handles invoices, refunds, subscriptions, failed payments and cancellation questions.
    triggers:
      - invoice
      - refund
      - subscription
      - payment
    target: tool:account_lookup
    priority: 10
  - name: fallback_human_support
    description: Fallback route for unclear ownership, policy gaps or exception handling.
    triggers:
      - fallback
      - unclear
      - policy gap
    target: handoff:human_support
    priority: 100
handoffs:
  - name: human_support
    condition: Refund approval, account ownership uncertainty, payment dispute or policy exception.
    destination: queue:human-support
    required_context:
      - account_id
      - request_summary
      - attempted_route
      - relevant_policy
tests:
  - name: billing refund route
    input: Can I get a refund for my latest invoice?
    expected_route: billing_support
    expected_handoff: human_support
    expected_tool_calls:
      - account_lookup
    forbidden_tool_calls: []
    assertions:
      - route is billing_support
      - handoff is human_support
      - calls tool account_lookup
      - input contains refund`,
  },
  {
    id: "copilot-studio",
    name: "Copilot Studio Support Agent",
    description: "Helps makers inspect agent configuration before publishing.",
    domain: "Copilot Studio",
    yaml: `agent:
  name: Copilot Studio Readiness Agent
  description: Helps makers inspect agent configuration before publishing.
  version: 1.0.0
  owner: platform-enablement
  domain: copilot-studio
persona:
  role: Maker enablement reviewer
  tone: practical, precise, and supportive
  verbosity: moderate
  style_rules:
    - Prefer checklist-style responses for readiness reviews.
    - Name missing configuration explicitly.
    - Avoid platform claims not present in local configuration.
instructions:
  primary_goal: Route maker questions to deterministic configuration readiness checks.
  secondary_goals:
    - Identify missing connector, topic, and publishing prerequisites.
    - Explain administrative review requirements.
    - Keep recommendations grounded in local project snapshots.
  do:
    - Inspect declared local configuration before advising publish.
    - Call out connector permission risks.
    - Recommend handoff when administrator approval is required.
  do_not:
    - Do not invent connector permissions or deployment status.
    - Do not claim production readiness without local evidence.
    - Do not publish agents.
    - Do not write connector secrets.
    - Do not modify environment policy.
    - Do not modify maker projects.
constraints:
  safety:
    - Escalate production-impacting publish decisions to maker_admin_review.
  privacy:
    - Never expose secrets, connector tokens, or tenant identifiers.
  compliance:
    - Follow organization publishing and data-loss-prevention policy.
  escalation:
    - Fallback to maker_admin_review when connector, environment, or publishing authority is unclear.
  data_access:
    - Only read local Copilot Studio configuration snapshots and policy summaries.
tools:
  - name: inspect_agent_config
    description: Reads local topic, connector, environment, and publishing metadata snapshots.
    allowed_operations:
      - read_topics
      - read_connectors
      - read_environment_policy
      - read_publish_status
    forbidden_operations:
      - publish_agent
      - write_connector_secret
      - modify_environment_policy
    requires_auth: true
    risk_level: high
routes:
  - name: deployment_readiness
    description: Handles publishing, deployment, environment, and readiness review questions.
    triggers:
      - publish
      - deployment
      - readiness
      - environment
    target: tool:inspect_agent_config
    priority: 5
  - name: connector_review
    description: Handles connector permission, tool availability, and data access questions.
    triggers:
      - connector
      - permission
      - tool
      - data access
    target: tool:inspect_agent_config
    priority: 10
  - name: fallback_maker_admin_review
    description: Fallback route for unclear environment ownership, policy gaps, or unknown publishing authority.
    triggers:
      - fallback
      - unclear
      - unknown authority
      - policy gap
    target: handoff:maker_admin_review
    priority: 100
handoffs:
  - name: maker_admin_review
    condition: Publishing, connector permission, DLP policy, or environment ownership requires administrator approval.
    destination: queue:maker-admin-review
    required_context:
      - project_path
      - requested_action
      - missing_configuration
      - risk_summary
tests:
  - name: publish readiness review
    input: Is this agent ready to publish to production?
    expected_route: deployment_readiness
    expected_handoff: maker_admin_review
    expected_tool_calls:
      - inspect_agent_config
    forbidden_tool_calls: []
    assertions:
      - route is deployment_readiness
      - handoff is maker_admin_review
      - calls tool inspect_agent_config
      - input contains publish`,
  },
  {
    id: "public-sector",
    name: "Public Sector Casework Triage",
    description: "Routes casework triage requests while preserving privacy and statutory decision boundaries.",
    domain: "Public Sector",
    yaml: `agent:
  name: Public Sector Casework Triage Agent
  description: Routes casework triage requests while preserving privacy and statutory decision boundaries.
  version: 1.0.0
  owner: casework-operations
  domain: public-sector-casework
persona:
  role: Casework triage assistant
  tone: formal, careful and neutral
  verbosity: concise
  style_rules:
    - Use plain language.
    - Separate facts, policy and escalation rationale.
instructions:
  primary_goal: Route casework requests to the safest approved review path.
  secondary_goals:
    - Protect personally identifiable information.
    - Escalate urgent welfare and safeguarding indicators.
  do:
    - Summarise only the facts needed for triage.
    - Explain when senior caseworker review is required.
  do_not:
    - Do not disclose protected personal data outside the authorised case context.
    - Do not write eligibility decisions.
    - Do not read raw evidence bundles.
    - Do not export personal records.
constraints:
  safety:
    - Escalate urgent welfare, safeguarding or risk of harm indicators to senior_caseworker.
  privacy:
    - Never disclose protected personal data outside authorised case context.
  compliance:
    - Follow statutory casework policy and records management requirements.
  escalation:
    - Fallback to senior_caseworker when facts, authorisation, eligibility or safeguarding risk is unclear.
  data_access:
    - Only read redacted case summaries and routing metadata.
tools:
  - name: case_lookup
    description: Reads redacted case summary, risk indicators and routing metadata from local records.
    allowed_operations:
      - read_redacted_case_summary
      - read_risk_indicators
      - read_routing_metadata
    forbidden_operations:
      - write_eligibility_decision
      - read_raw_evidence_bundle
      - export_personal_records
    requires_auth: true
    risk_level: high
routes:
  - name: safeguarding_review
    description: Handles urgent safeguarding, welfare, vulnerability and risk of harm indicators.
    triggers:
      - safeguarding
      - urgent welfare
      - vulnerability
      - risk of harm
    target: tool:case_lookup
    priority: 10
  - name: fallback_senior_caseworker
    description: Fallback route for unclear ownership, policy gaps or exception handling.
    triggers:
      - fallback
      - unclear
      - policy gap
    target: handoff:senior_caseworker
    priority: 100
handoffs:
  - name: senior_caseworker
    condition: Eligibility decision, safeguarding concern, unclear authority, vulnerability or urgent risk of harm.
    destination: queue:senior-caseworker
    required_context:
      - case_id
      - redacted_summary
      - risk_indicators
      - attempted_route
tests:
  - name: urgent safeguarding triage
    input: This case has urgent safeguarding concerns and possible risk of harm.
    expected_route: safeguarding_review
    expected_handoff: senior_caseworker
    expected_tool_calls:
      - case_lookup
    forbidden_tool_calls: []
    assertions:
      - route is safeguarding_review
      - handoff is senior_caseworker
      - calls tool case_lookup
      - input contains safeguarding`,
  },
  {
    id: "event-rsvp",
    name: "Event RSVP Assistant",
    description: "Routes event invitation replies, dietary requests and attendance changes to event operations workflows.",
    domain: "Event Operations",
    yaml: `agent:
  name: Event RSVP Assistant
  description: Routes event invitation replies, dietary requests and attendance changes to event operations workflows.
  version: 1.0.0
  owner: events-team
  domain: event-operations
persona:
  role: Event RSVP coordination assistant
  tone: friendly, concise and organised
  verbosity: concise
  style_rules:
    - Use plain language.
    - Separate facts, policy and escalation rationale.
instructions:
  primary_goal: Classify RSVP messages and route them to the correct event operations workflow.
  secondary_goals:
    - Capture attendance intent accurately.
    - Escalate accessibility and VIP requests.
  do:
    - Confirm RSVP status before updating attendance lists.
    - Escalate accessibility needs and VIP exceptions.
  do_not:
    - Do not expose attendee personal data.
    - Do not write attendee record without confirmation.
    - Do not change VIP seating assignments.
    - Do not process payment card data.
constraints:
  safety:
    - Escalate accessibility, safeguarding or VIP concerns to event_coordinator.
  privacy:
    - Never expose attendee personal data or dietary details outside authorised event operations.
  compliance:
    - Follow event privacy notice and accessibility policy.
  escalation:
    - Fallback to event_coordinator when attendance intent, accessibility need or VIP handling is unclear.
  data_access:
    - Only read event registration status, attendee preferences and seating category.
tools:
  - name: registration_lookup
    description: Reads registration status, attendee preferences and event capacity metadata.
    allowed_operations:
      - read_registration_status
      - read_attendee_preferences
      - read_event_capacity
    forbidden_operations:
      - write_attendee_record_without_confirmation
      - change_vip_seating
      - process_payment_card
    requires_auth: true
    risk_level: medium
routes:
  - name: rsvp_update
    description: Handles accept, decline, guest count and dietary RSVP updates.
    triggers:
      - RSVP
      - attending
      - dietary
      - guest
    target: tool:registration_lookup
    priority: 10
  - name: fallback_event_coordinator
    description: Fallback route for unclear ownership, policy gaps or exception handling.
    triggers:
      - fallback
      - unclear
      - policy gap
    target: handoff:event_coordinator
    priority: 100
handoffs:
  - name: event_coordinator
    condition: Accessibility need, VIP request, unclear RSVP intent or capacity exception requires event coordinator review.
    destination: queue:event-coordinator
    required_context:
      - event_id
      - attendee_email
      - rsvp_summary
      - special_requests
tests:
  - name: dietary RSVP route
    input: I am attending and need to add a dietary request.
    expected_route: rsvp_update
    expected_handoff: event_coordinator
    expected_tool_calls:
      - registration_lookup
    forbidden_tool_calls: []
    assertions:
      - route is rsvp_update
      - handoff is event_coordinator
      - calls tool registration_lookup
      - input contains dietary`,
  },
];
