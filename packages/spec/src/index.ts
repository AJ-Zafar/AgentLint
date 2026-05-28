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
  additionalProperties?: boolean | JsonSchema;
  minItems?: number;
  minLength?: number;
  [key: string]: unknown;
};

export type AgentSpecMetadata = {
  name: string;
  version: string;
  description?: string;
  owners?: string[];
};

export type AgentSpecAgent = {
  id: string;
  description: string;
};

export type AgentSpecInstructions = {
  system: string;
  goals: string[];
  constraints: string[];
  fallback: string;
};

export type AgentSpecRoute = {
  id: string;
  when: string;
  instructions: string[];
  tools?: string[];
  escalateTo?: string;
};

export type AgentSpecTool = {
  id: string;
  description: string;
  inputSchema: JsonSchema;
};

export type AgentSpecEscalation = {
  id: string;
  when: string;
  target: string;
};

export type AgentSpecTestExpectation = {
  route?: string;
  escalation?: string;
  tools?: string[];
};

export type AgentSpecTest = {
  id: string;
  input: string;
  expect: AgentSpecTestExpectation;
};

export type AgentSpecDocument = {
  agentspec: "1.0";
  metadata: AgentSpecMetadata;
  agent: AgentSpecAgent;
  instructions: AgentSpecInstructions;
  routes: AgentSpecRoute[];
  tools: AgentSpecTool[];
  escalations: AgentSpecEscalation[];
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

export const jsonSchemaSchema: z.ZodType<JsonSchema> = z.lazy(() =>
  z
    .object({
      $schema: z.string().optional(),
      type: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      properties: z.record(z.string(), jsonSchemaSchema).optional(),
      required: z.array(z.string()).optional(),
      items: jsonSchemaSchema.optional(),
      enum: z.array(z.unknown()).optional(),
      additionalProperties: z.union([z.boolean(), jsonSchemaSchema]).optional(),
      minItems: z.number().optional(),
      minLength: z.number().optional()
    })
    .catchall(z.unknown())
);

export const agentSpecSchema = z.object({
  agentspec: z.literal("1.0"),
  metadata: z.object({
    name: nonEmptyString,
    version: z.coerce.string().pipe(nonEmptyString),
    description: nonEmptyString.optional(),
    owners: z.array(nonEmptyString).optional()
  }),
  agent: z.object({
    id: nonEmptyString,
    description: nonEmptyString
  }),
  instructions: z.object({
    system: nonEmptyString,
    goals: z.array(nonEmptyString),
    constraints: z.array(nonEmptyString),
    fallback: nonEmptyString
  }),
  routes: z.array(
    z.object({
      id: nonEmptyString,
      when: nonEmptyString,
      instructions: z.array(nonEmptyString),
      tools: z.array(nonEmptyString).optional(),
      escalateTo: nonEmptyString.optional()
    })
  ),
  tools: z.array(
    z.object({
      id: nonEmptyString,
      description: nonEmptyString,
      inputSchema: jsonSchemaSchema
    })
  ),
  escalations: z.array(
    z.object({
      id: nonEmptyString,
      when: nonEmptyString,
      target: nonEmptyString
    })
  ),
  tests: z
    .array(
      z.object({
        id: nonEmptyString,
        input: nonEmptyString,
        expect: z.object({
          route: nonEmptyString.optional(),
          escalation: nonEmptyString.optional(),
          tools: z.array(nonEmptyString).optional()
        })
      })
    )
    .optional()
});

export const agentSpecJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "AgentSpec",
  type: "object",
  required: ["agentspec", "metadata", "agent", "instructions", "routes", "tools", "escalations"],
  additionalProperties: false,
  properties: {
    agentspec: { const: "1.0" },
    metadata: {
      type: "object",
      required: ["name", "version"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        version: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        owners: { type: "array", items: { type: "string", minLength: 1 } }
      }
    },
    agent: {
      type: "object",
      required: ["id", "description"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 }
      }
    },
    instructions: {
      type: "object",
      required: ["system", "goals", "constraints", "fallback"],
      additionalProperties: false,
      properties: {
        system: { type: "string", minLength: 1 },
        goals: { type: "array", items: { type: "string", minLength: 1 } },
        constraints: { type: "array", items: { type: "string", minLength: 1 } },
        fallback: { type: "string", minLength: 1 }
      }
    },
    routes: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "when", "instructions"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          when: { type: "string", minLength: 1 },
          instructions: { type: "array", items: { type: "string", minLength: 1 } },
          tools: { type: "array", items: { type: "string", minLength: 1 } },
          escalateTo: { type: "string", minLength: 1 }
        }
      }
    },
    tools: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "description", "inputSchema"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          inputSchema: { type: "object" }
        }
      }
    },
    escalations: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "when", "target"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          when: { type: "string", minLength: 1 },
          target: { type: "string", minLength: 1 }
        }
      }
    },
    tests: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "input", "expect"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          input: { type: "string", minLength: 1 },
          expect: {
            type: "object",
            additionalProperties: false,
            properties: {
              route: { type: "string", minLength: 1 },
              escalation: { type: "string", minLength: 1 },
              tools: { type: "array", items: { type: "string", minLength: 1 } }
            }
          }
        }
      }
    }
  }
} as const;

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
