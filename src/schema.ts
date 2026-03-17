import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema: z.ZodType<any> = z
  .object({
    $schema: z
      .string()
      .describe("JSON schema reference for configuration validation")
      .optional(),
    logLevel: z
      .enum(["DEBUG", "INFO", "WARN", "ERROR"])
      .describe("Log level")
      .optional(),
    server: z
      .object({
        port: z
          .number()
          .int()
          .gt(0)
          .lte(9007199254740991)
          .describe("Port to listen on")
          .optional(),
        hostname: z.string().describe("Hostname to listen on").optional(),
        mdns: z.boolean().describe("Enable mDNS service discovery").optional(),
        mdnsDomain: z
          .string()
          .describe(
            "Custom domain name for mDNS service (default: opencode.local)",
          )
          .optional(),
        cors: z
          .array(z.string())
          .describe("Additional domains to allow for CORS")
          .optional(),
      })
      .strict()
      .describe("Server configuration for opencode serve and web commands")
      .optional(),
    command: z
      .record(
        z
          .object({
            template: z.string(),
            description: z.string().optional(),
            agent: z.string().optional(),
            model: z.string().optional(),
            subtask: z.boolean().optional(),
          })
          .strict(),
      )
      .describe("Command configuration, see https://opencode.ai/docs/commands")
      .optional(),
    skills: z
      .object({
        paths: z
          .array(z.string())
          .describe("Additional paths to skill folders")
          .optional(),
        urls: z
          .array(z.string())
          .describe(
            "URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)",
          )
          .optional(),
      })
      .strict()
      .describe("Additional skill folder paths")
      .optional(),
    watcher: z
      .object({ ignore: z.array(z.string()).optional() })
      .strict()
      .optional(),
    plugin: z.array(z.string()).optional(),
    snapshot: z
      .boolean()
      .describe(
        "Enable or disable snapshot tracking. When false, filesystem snapshots are not recorded and undoing or reverting will not undo/redo file changes. Defaults to true.",
      )
      .optional(),
    share: z
      .enum(["manual", "auto", "disabled"])
      .describe(
        "Control sharing behavior:'manual' allows manual sharing via commands, 'auto' enables automatic sharing, 'disabled' disables all sharing",
      )
      .optional(),
    autoshare: z
      .boolean()
      .describe(
        "@deprecated Use 'share' field instead. Share newly created sessions automatically",
      )
      .optional(),
    autoupdate: z
      .union([z.boolean(), z.literal("notify")])
      .describe(
        "Automatically update to the latest version. Set to true to auto-update, false to disable, or 'notify' to show update notifications",
      )
      .optional(),
    disabled_providers: z
      .array(z.string())
      .describe("Disable providers that are loaded automatically")
      .optional(),
    enabled_providers: z
      .array(z.string())
      .describe(
        "When set, ONLY these providers will be enabled. All other providers will be ignored",
      )
      .optional(),
    model: z
      .string()
      .describe(
        "Model to use in the format of provider/model, eg anthropic/claude-2",
      )
      .optional(),
    small_model: z
      .string()
      .describe(
        "Small model to use for tasks like title generation in the format of provider/model",
      )
      .optional(),
    default_agent: z
      .string()
      .describe(
        "Default agent to use when none is specified. Must be a primary agent. Falls back to 'build' if not set or if the specified agent is invalid.",
      )
      .optional(),
    username: z
      .string()
      .describe(
        "Custom username to display in conversations instead of system username",
      )
      .optional(),
    mode: z
      .object({
        build: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        plan: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
      })
      .catchall(
        z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any()),
      )
      .describe("@deprecated Use `agent` field instead.")
      .optional(),
    agent: z
      .object({
        plan: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        build: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        general: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        explore: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        title: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        summary: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
        compaction: z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any())
          .optional(),
      })
      .catchall(
        z
          .object({
            model: z.string().optional(),
            variant: z
              .string()
              .describe(
                "Default model variant for this agent (applies only when using the agent's configured model).",
              )
              .optional(),
            temperature: z.number().optional(),
            top_p: z.number().optional(),
            prompt: z.string().optional(),
            tools: z
              .record(z.boolean())
              .describe("@deprecated Use 'permission' field instead")
              .optional(),
            disable: z.boolean().optional(),
            description: z
              .string()
              .describe("Description of when to use the agent")
              .optional(),
            mode: z.enum(["subagent", "primary", "all"]).optional(),
            hidden: z
              .boolean()
              .describe(
                "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)",
              )
              .optional(),
            options: z.record(z.any()).optional(),
            color: z
              .union([
                z.string().regex(new RegExp("^#[0-9a-fA-F]{6}$")),
                z.enum([
                  "primary",
                  "secondary",
                  "accent",
                  "success",
                  "warning",
                  "error",
                  "info",
                ]),
              ])
              .describe(
                "Hex color code (e.g., #FF5733) or theme color (e.g., primary)",
              )
              .optional(),
            steps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe(
                "Maximum number of agentic iterations before forcing text-only response",
              )
              .optional(),
            maxSteps: z
              .number()
              .int()
              .gt(0)
              .lte(9007199254740991)
              .describe("@deprecated Use 'steps' field instead.")
              .optional(),
            permission: z
              .union([
                z
                  .object({
                    __originalKeys: z.array(z.string()).optional(),
                    read: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    edit: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    glob: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    grep: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    list: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    bash: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    task: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    external_directory: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    todowrite: z.enum(["ask", "allow", "deny"]).optional(),
                    todoread: z.enum(["ask", "allow", "deny"]).optional(),
                    question: z.enum(["ask", "allow", "deny"]).optional(),
                    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
                    websearch: z.enum(["ask", "allow", "deny"]).optional(),
                    codesearch: z.enum(["ask", "allow", "deny"]).optional(),
                    lsp: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                    doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
                    skill: z
                      .union([
                        z.enum(["ask", "allow", "deny"]),
                        z.record(z.enum(["ask", "allow", "deny"])),
                      ])
                      .optional(),
                  })
                  .catchall(
                    z.union([
                      z.enum(["ask", "allow", "deny"]),
                      z.record(z.enum(["ask", "allow", "deny"])),
                    ]),
                  ),
                z.enum(["ask", "allow", "deny"]),
              ])
              .optional(),
          })
          .catchall(z.any()),
      )
      .describe("Agent configuration, see https://opencode.ai/docs/agents")
      .optional(),
    provider: z
      .record(
        z
          .object({
            api: z.string().optional(),
            name: z.string().optional(),
            env: z.array(z.string()).optional(),
            id: z.string().optional(),
            npm: z.string().optional(),
            models: z
              .record(
                z
                  .object({
                    id: z.string().optional(),
                    name: z.string().optional(),
                    family: z.string().optional(),
                    release_date: z.string().optional(),
                    attachment: z.boolean().optional(),
                    reasoning: z.boolean().optional(),
                    temperature: z.boolean().optional(),
                    tool_call: z.boolean().optional(),
                    interleaved: z
                      .union([
                        z.literal(true),
                        z
                          .object({
                            field: z.enum([
                              "reasoning_content",
                              "reasoning_details",
                            ]),
                          })
                          .strict(),
                      ])
                      .optional(),
                    cost: z
                      .object({
                        input: z.number(),
                        output: z.number(),
                        cache_read: z.number().optional(),
                        cache_write: z.number().optional(),
                        context_over_200k: z
                          .object({
                            input: z.number(),
                            output: z.number(),
                            cache_read: z.number().optional(),
                            cache_write: z.number().optional(),
                          })
                          .strict()
                          .optional(),
                      })
                      .strict()
                      .optional(),
                    limit: z
                      .object({
                        context: z.number(),
                        input: z.number().optional(),
                        output: z.number(),
                      })
                      .strict()
                      .optional(),
                    modalities: z
                      .object({
                        input: z.array(
                          z.enum(["text", "audio", "image", "video", "pdf"]),
                        ),
                        output: z.array(
                          z.enum(["text", "audio", "image", "video", "pdf"]),
                        ),
                      })
                      .strict()
                      .optional(),
                    experimental: z.boolean().optional(),
                    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
                    options: z.record(z.any()).optional(),
                    headers: z.record(z.string()).optional(),
                    provider: z
                      .object({
                        npm: z.string().optional(),
                        api: z.string().optional(),
                      })
                      .strict()
                      .optional(),
                    variants: z
                      .record(
                        z
                          .object({
                            disabled: z
                              .boolean()
                              .describe("Disable this variant for the model")
                              .optional(),
                          })
                          .catchall(z.any()),
                      )
                      .describe("Variant-specific configuration")
                      .optional(),
                  })
                  .strict(),
              )
              .optional(),
            whitelist: z.array(z.string()).optional(),
            blacklist: z.array(z.string()).optional(),
            options: z
              .object({
                apiKey: z.string().optional(),
                baseURL: z.string().optional(),
                enterpriseUrl: z
                  .string()
                  .describe("GitHub Enterprise URL for copilot authentication")
                  .optional(),
                setCacheKey: z
                  .boolean()
                  .describe(
                    "Enable promptCacheKey for this provider (default false)",
                  )
                  .optional(),
                timeout: z
                  .union([
                    z
                      .number()
                      .int()
                      .gt(0)
                      .lte(9007199254740991)
                      .describe(
                        "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
                      ),
                    z
                      .boolean()
                      .describe("Disable timeout for this provider entirely."),
                  ])
                  .describe(
                    "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
                  )
                  .optional(),
                chunkTimeout: z
                  .number()
                  .int()
                  .gt(0)
                  .lte(9007199254740991)
                  .describe(
                    "Timeout in milliseconds between streamed SSE chunks for this provider. If no chunk arrives within this window, the request is aborted.",
                  )
                  .optional(),
              })
              .catchall(z.any())
              .optional(),
          })
          .strict(),
      )
      .describe("Custom provider configurations and model overrides")
      .optional(),
    mcp: z
      .record(
        z.union([
          z.union([
            z
              .object({
                type: z
                  .literal("local")
                  .describe("Type of MCP server connection"),
                command: z
                  .array(z.string())
                  .describe("Command and arguments to run the MCP server"),
                environment: z
                  .record(z.string())
                  .describe(
                    "Environment variables to set when running the MCP server",
                  )
                  .optional(),
                enabled: z
                  .boolean()
                  .describe("Enable or disable the MCP server on startup")
                  .optional(),
                timeout: z
                  .number()
                  .int()
                  .gt(0)
                  .lte(9007199254740991)
                  .describe(
                    "Timeout in ms for MCP server requests. Defaults to 5000 (5 seconds) if not specified.",
                  )
                  .optional(),
              })
              .strict(),
            z
              .object({
                type: z
                  .literal("remote")
                  .describe("Type of MCP server connection"),
                url: z.string().describe("URL of the remote MCP server"),
                enabled: z
                  .boolean()
                  .describe("Enable or disable the MCP server on startup")
                  .optional(),
                headers: z
                  .record(z.string())
                  .describe("Headers to send with the request")
                  .optional(),
                oauth: z
                  .union([
                    z
                      .object({
                        clientId: z
                          .string()
                          .describe(
                            "OAuth client ID. If not provided, dynamic client registration (RFC 7591) will be attempted.",
                          )
                          .optional(),
                        clientSecret: z
                          .string()
                          .describe(
                            "OAuth client secret (if required by the authorization server)",
                          )
                          .optional(),
                        scope: z
                          .string()
                          .describe(
                            "OAuth scopes to request during authorization",
                          )
                          .optional(),
                      })
                      .strict(),
                    z.boolean(),
                  ])
                  .describe(
                    "OAuth authentication configuration for the MCP server. Set to false to disable OAuth auto-detection.",
                  )
                  .optional(),
                timeout: z
                  .number()
                  .int()
                  .gt(0)
                  .lte(9007199254740991)
                  .describe(
                    "Timeout in ms for MCP server requests. Defaults to 5000 (5 seconds) if not specified.",
                  )
                  .optional(),
              })
              .strict(),
          ]),
          z.object({ enabled: z.boolean() }).strict(),
        ]),
      )
      .describe("MCP (Model Context Protocol) server configurations")
      .optional(),
    formatter: z
      .union([
        z.boolean(),
        z.record(
          z
            .object({
              disabled: z.boolean().optional(),
              command: z.array(z.string()).optional(),
              environment: z.record(z.string()).optional(),
              extensions: z.array(z.string()).optional(),
            })
            .strict(),
        ),
      ])
      .optional(),
    lsp: z
      .union([
        z.boolean(),
        z.record(
          z.union([
            z.object({ disabled: z.literal(true) }).strict(),
            z
              .object({
                command: z.array(z.string()),
                extensions: z.array(z.string()).optional(),
                disabled: z.boolean().optional(),
                env: z.record(z.string()).optional(),
                initialization: z.record(z.any()).optional(),
              })
              .strict(),
          ]),
        ),
      ])
      .optional(),
    instructions: z
      .array(z.string())
      .describe("Additional instruction files or patterns to include")
      .optional(),
    layout: z
      .enum(["auto", "stretch"])
      .describe("@deprecated Always uses stretch layout.")
      .optional(),
    permission: z
      .union([
        z
          .object({
            __originalKeys: z.array(z.string()).optional(),
            read: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            edit: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            glob: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            grep: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            list: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            bash: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            task: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            external_directory: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            todowrite: z.enum(["ask", "allow", "deny"]).optional(),
            todoread: z.enum(["ask", "allow", "deny"]).optional(),
            question: z.enum(["ask", "allow", "deny"]).optional(),
            webfetch: z.enum(["ask", "allow", "deny"]).optional(),
            websearch: z.enum(["ask", "allow", "deny"]).optional(),
            codesearch: z.enum(["ask", "allow", "deny"]).optional(),
            lsp: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
            doom_loop: z.enum(["ask", "allow", "deny"]).optional(),
            skill: z
              .union([
                z.enum(["ask", "allow", "deny"]),
                z.record(z.enum(["ask", "allow", "deny"])),
              ])
              .optional(),
          })
          .catchall(
            z.union([
              z.enum(["ask", "allow", "deny"]),
              z.record(z.enum(["ask", "allow", "deny"])),
            ]),
          ),
        z.enum(["ask", "allow", "deny"]),
      ])
      .optional(),
    tools: z.record(z.boolean()).optional(),
    enterprise: z
      .object({
        url: z.string().describe("Enterprise URL").optional(),
      })
      .strict()
      .optional(),
    compaction: z
      .object({
        auto: z
          .boolean()
          .describe(
            "Enable automatic compaction when context is full (default: true)",
          )
          .optional(),
        prune: z
          .boolean()
          .describe("Enable pruning of old tool outputs (default: true)")
          .optional(),
        reserved: z
          .number()
          .int()
          .gte(0)
          .lte(9007199254740991)
          .describe(
            "Token buffer for compaction. Leaves enough window to avoid overflow during compaction.",
          )
          .optional(),
      })
      .strict()
      .optional(),
    experimental: z
      .object({
        disable_paste_summary: z.boolean().optional(),
        batch_tool: z.boolean().describe("Enable the batch tool").optional(),
        openTelemetry: z
          .boolean()
          .describe(
            "Enable OpenTelemetry spans for AI SDK calls (using the 'experimental_telemetry' flag)",
          )
          .optional(),
        primary_tools: z
          .array(z.string())
          .describe("Tools that should only be available to primary agents.")
          .optional(),
        continue_loop_on_deny: z
          .boolean()
          .describe("Continue the agent loop when a tool call is denied")
          .optional(),
        mcp_timeout: z
          .number()
          .int()
          .gt(0)
          .lte(9007199254740991)
          .describe(
            "Timeout in milliseconds for model context protocol (MCP) requests",
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
