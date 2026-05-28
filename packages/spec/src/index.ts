import { z } from "zod";

export type JsonSchema = {
  $schema?: string;
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  additionalProperties?: boolean | JsonSchema;
  minItems?: number;
  minLength?: number;
  minimum?: number;
  [key: string]: unknown;
};

export type AgentSpecRiskLevel = "low" | "medium" | "high" | "critical";

export type AgentConditionExpression =
  | string
  | { all: AgentConditionExpression[] }
  | { any: AgentConditionExpression[] }
  | { not: AgentConditionExpression };

export type AgentSpecPrecedence = {
  routes?: string[];
};

export type AgentSpecCompilerMetadata = {
  generated_by: string;
  status: "experimental";
  confidence: Record<string, number>;
  inferred_fields: string[];
  warnings: string[];
};

export type AgentSpecAgent = {
  name: string;
  description: string;
  version: string;
  owner: string;
  domain: string;
};

export type AgentSpecPersona = {
  role: string;
  tone: string;
  verbosity: string;
  style_rules: string[];
};

export type AgentSpecInstructions = {
  primary_goal: string;
  secondary_goals: string[];
  do: string[];
  do_not: string[];
};

export type AgentSpecConstraints = {
  safety: string[];
  privacy: string[];
  compliance: string[];
  escalation: string[];
  data_access: string[];
  evaluation?: AgentConditionExpression;
};

export type AgentSpecTool = {
  name: string;
  description: string;
  allowed_operations: string[];
  forbidden_operations: string[];
  requires_auth: boolean;
  risk_level?: AgentSpecRiskLevel;
};

export type AgentSpecRoute = {
  name: string;
  description: string;
  triggers: string[];
  target: string;
  priority: number;
  conditions?: AgentConditionExpression;
  depends_on?: string[];
};

export type AgentSpecHandoff = {
  name: string;
  condition: string;
  destination: string;
  required_context: string[];
};

export type AgentSpecScenario = {
  name: string;
  input: string;
  context: Record<string, string | number | boolean>;
};

export type AgentSpecTest = {
  name: string;
  input: string;
  expected_route?: string;
  expected_handoff?: string;
  expected_tool_calls: string[];
  forbidden_tool_calls: string[];
  assertions: string[];
};

export type AgentSpecDocument = {
  agent: AgentSpecAgent;
  persona: AgentSpecPersona;
  instructions: AgentSpecInstructions;
  constraints: AgentSpecConstraints;
  tools: AgentSpecTool[];
  routes: AgentSpecRoute[];
  handoffs: AgentSpecHandoff[];
  precedence?: AgentSpecPrecedence;
  compiler?: AgentSpecCompilerMetadata;
  scenarios?: AgentSpecScenario[];
  tests?: AgentSpecTest[];
};

export type AgentSpecValidationIssue = {
  path: string;
  message: string;
};

export type AgentSpecValidationResult =
  | {
      success: true;
      data: AgentSpecDocument;
      issues: [];
    }
  | {
      success: false;
      issues: AgentSpecValidationIssue[];
    };

const nonEmptyString = z.string().trim().min(1);
const linterCheckedString = z.string();
const nonEmptyStringArray = z.array(nonEmptyString);

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const conditionExpressionSchema: z.ZodType<AgentConditionExpression> = z.lazy(() =>
  z.union([
    nonEmptyString,
    z.strictObject({ all: z.array(conditionExpressionSchema) }),
    z.strictObject({ any: z.array(conditionExpressionSchema) }),
    z.strictObject({ not: conditionExpressionSchema })
  ])
);

export const agentSpecSchema = z.strictObject({
  agent: z.strictObject({
    name: nonEmptyString,
    description: nonEmptyString,
    version: z.coerce.string().pipe(nonEmptyString),
    owner: nonEmptyString,
    domain: nonEmptyString
  }),
  persona: z.strictObject({
    role: nonEmptyString,
    tone: nonEmptyString,
    verbosity: nonEmptyString,
    style_rules: nonEmptyStringArray
  }),
  instructions: z.strictObject({
    primary_goal: linterCheckedString,
    secondary_goals: nonEmptyStringArray,
    do: nonEmptyStringArray,
    do_not: nonEmptyStringArray
  }),
  constraints: z.strictObject({
    safety: nonEmptyStringArray,
    privacy: nonEmptyStringArray,
    compliance: nonEmptyStringArray,
    escalation: nonEmptyStringArray,
    data_access: nonEmptyStringArray,
    evaluation: conditionExpressionSchema.optional()
  }),
  tools: z.array(
    z.strictObject({
      name: nonEmptyString,
      description: nonEmptyString,
      allowed_operations: nonEmptyStringArray,
      forbidden_operations: z.array(nonEmptyString),
      requires_auth: z.boolean(),
      risk_level: riskLevelSchema.optional()
    })
  ),
  routes: z.array(
    z.strictObject({
      name: nonEmptyString,
      description: nonEmptyString,
      triggers: nonEmptyStringArray,
      target: nonEmptyString,
      priority: z.number().int().min(0),
      conditions: conditionExpressionSchema.optional(),
      depends_on: z.array(nonEmptyString).optional()
    })
  ),
  handoffs: z.array(
    z.strictObject({
      name: nonEmptyString,
      condition: linterCheckedString,
      destination: nonEmptyString,
      required_context: z.array(nonEmptyString)
    })
  ),
  precedence: z.strictObject({ routes: z.array(nonEmptyString).optional() }).optional(),
  compiler: z.strictObject({
    generated_by: nonEmptyString,
    status: z.literal("experimental"),
    confidence: z.record(z.string(), z.number().min(0).max(1)),
    inferred_fields: z.array(nonEmptyString),
    warnings: z.array(z.string())
  }).optional(),
  scenarios: z.array(z.strictObject({
    name: nonEmptyString,
    input: nonEmptyString,
    context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  })).optional(),
  tests: z
    .array(
      z.strictObject({
        name: nonEmptyString,
        input: nonEmptyString,
        expected_route: nonEmptyString.optional(),
        expected_handoff: nonEmptyString.optional(),
        expected_tool_calls: z.array(nonEmptyString),
        forbidden_tool_calls: z.array(nonEmptyString),
        assertions: z.array(nonEmptyString)
      })
    )
    .optional()
});

type SchemaProperties = Record<string, JsonSchema>;

const stringSchema = (): JsonSchema => ({ type: "string", minLength: 1 });
const linterCheckedStringSchema = (): JsonSchema => ({ type: "string" });
const booleanSchema = (): JsonSchema => ({ type: "boolean" });
const integerSchema = (minimum = 0): JsonSchema => ({ type: "integer", minimum });
const stringArraySchema = (): JsonSchema => ({ type: "array", items: stringSchema() });
const enumSchema = (values: string[]): JsonSchema => ({ type: "string", enum: values });
const conditionExpressionJsonSchema = (): JsonSchema => ({
  anyOf: [
    stringSchema(),
    objectSchema({ all: { type: "array", items: { $ref: "#/$defs/conditionExpression" } } }),
    objectSchema({ any: { type: "array", items: { $ref: "#/$defs/conditionExpression" } } }),
    objectSchema({ not: { $ref: "#/$defs/conditionExpression" } })
  ]
});

function objectSchema(properties: SchemaProperties, required = Object.keys(properties)): JsonSchema {
  return {
    type: "object",
    required,
    additionalProperties: false,
    properties
  };
}

function arrayOf(item: JsonSchema): JsonSchema {
  return {
    type: "array",
    items: item
  };
}

export function generateAgentSpecJsonSchema(): JsonSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "AgentSpec",
    type: "object",
    required: ["agent", "persona", "instructions", "constraints", "tools", "routes", "handoffs"],
    additionalProperties: false,
    $defs: {
      conditionExpression: conditionExpressionJsonSchema()
    },
    properties: {
      agent: objectSchema({
        name: stringSchema(),
        description: stringSchema(),
        version: stringSchema(),
        owner: stringSchema(),
        domain: stringSchema()
      }),
      persona: objectSchema({
        role: stringSchema(),
        tone: stringSchema(),
        verbosity: stringSchema(),
        style_rules: stringArraySchema()
      }),
      instructions: objectSchema({
        primary_goal: linterCheckedStringSchema(),
        secondary_goals: stringArraySchema(),
        do: stringArraySchema(),
        do_not: stringArraySchema()
      }),
      constraints: objectSchema({
        safety: stringArraySchema(),
        privacy: stringArraySchema(),
        compliance: stringArraySchema(),
        escalation: stringArraySchema(),
        data_access: stringArraySchema(),
        evaluation: conditionExpressionJsonSchema()
      }, ["safety", "privacy", "compliance", "escalation", "data_access"]),
      tools: arrayOf(
        objectSchema({
          name: stringSchema(),
          description: stringSchema(),
          allowed_operations: stringArraySchema(),
          forbidden_operations: stringArraySchema(),
          requires_auth: booleanSchema(),
          risk_level: enumSchema(["low", "medium", "high", "critical"])
        }, ["name", "description", "allowed_operations", "forbidden_operations", "requires_auth"])
      ),
      routes: arrayOf(
        objectSchema({
          name: stringSchema(),
          description: stringSchema(),
          triggers: stringArraySchema(),
          target: stringSchema(),
          priority: integerSchema(0),
          conditions: conditionExpressionJsonSchema(),
          depends_on: stringArraySchema()
        }, ["name", "description", "triggers", "target", "priority"])
      ),
      handoffs: arrayOf(
        objectSchema({
          name: stringSchema(),
          condition: linterCheckedStringSchema(),
          destination: stringSchema(),
          required_context: stringArraySchema()
        })
      ),
      precedence: objectSchema({ routes: stringArraySchema() }, []),
      compiler: objectSchema({
        generated_by: stringSchema(),
        status: { const: "experimental" },
        confidence: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 1 } },
        inferred_fields: stringArraySchema(),
        warnings: { type: "array", items: { type: "string" } }
      }),
      scenarios: arrayOf(objectSchema({
        name: stringSchema(),
        input: stringSchema(),
        context: { type: "object", additionalProperties: true }
      })),
      tests: arrayOf(
        objectSchema(
          {
            name: stringSchema(),
            input: stringSchema(),
            expected_route: stringSchema(),
            expected_handoff: stringSchema(),
            expected_tool_calls: stringArraySchema(),
            forbidden_tool_calls: stringArraySchema(),
            assertions: stringArraySchema()
          },
          ["name", "input", "expected_tool_calls", "forbidden_tool_calls", "assertions"]
        )
      )
    }
  };
}

export const agentSpecJsonSchema = generateAgentSpecJsonSchema();

export function validateAgentSpec(input: unknown): AgentSpecValidationResult {
  const result = agentSpecSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data, issues: [] };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}
